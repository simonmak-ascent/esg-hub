import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BASE_URL = process.env.ESG_HUB_API_URL || "https://esg-hub.ascent.partners";
const API_BASE = process.env.ESG_HUB_API_BASE || BASE_URL;
const WRITE_TOKEN = process.env.ESG_HUB_WRITE_TOKEN || "";
const SERVER_NAME = "esg-hub";
const SERVER_VERSION = "1.4.0";
const TOOL_COUNT = 15;

/**
 * Helper to call the ESG Hub REST API
 */
class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiGet<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`/api/v1${path}`, API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const url = new URL(`/api/v1${path}`, API_BASE);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (WRITE_TOKEN) {
    headers["Authorization"] = `Bearer ${WRITE_TOKEN}`;
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const json = await res.json();
      if (json.error) detail = json.error;
      else if (json.message) detail = json.message;
    } catch {
      /* ignore parse failure */
    }
    throw new ApiError(res.status, `API error: ${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const url = new URL(`/api/v1${path}`, API_BASE);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (WRITE_TOKEN) {
    headers["Authorization"] = `Bearer ${WRITE_TOKEN}`;
  }
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const json = await res.json();
      if (json.error) detail = json.error;
      else if (json.message) detail = json.message;
    } catch {
      /* ignore parse failure */
    }
    throw new ApiError(res.status, `API error: ${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Structured error envelope per MCP best practice (AC-B3).
 */
function toolError(code: string, message: string, retryable: boolean, hint: string) {
  return {
    content: [{ type: "text" as const, text: `${message}\n\nHint: ${hint}` }],
    isError: true,
    structuredContent: {
      error: { code, message, retryable, hint },
    },
  };
}

function mapApiError(err: unknown, notFoundHint: string) {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return toolError("NOT_FOUND", "The requested item was not found.", false, notFoundHint);
    }
    const retryable = err.status >= 500;
    return toolError(
      "UPSTREAM_ERROR",
      `The ESG Hub API returned an error (HTTP ${err.status}).`,
      retryable,
      retryable
        ? "Retry in a few seconds; if it persists, the API may be redeploying."
        : "Check the request parameters and try again."
    );
  }
  return toolError(
    "UPSTREAM_ERROR",
    `Could not reach the ESG Hub API (${String(err)}).`,
    true,
    "Check network connectivity and try again."
  );
}

function mapWriteError(err: unknown, notFoundHint?: string) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return toolError(
        "UNAUTHORIZED",
        "The write token is missing, expired, or invalid.",
        false,
        "Set ESG_HUB_WRITE_TOKEN to a valid API write token and retry."
      );
    }
    if (err.status === 429) {
      return toolError(
        "RATE_LIMITED",
        "Too many write requests — rate limit hit.",
        true,
        "Wait a few seconds before retrying."
      );
    }
    if (err.status === 400) {
      return toolError(
        "BAD_REQUEST",
        `Invalid request: ${err.message}`,
        false,
        "Check the input parameters and try again."
      );
    }
  }
  return mapApiError(err, notFoundHint || "Re-check your inputs and try again.");
}

// ── Shared output schemas ───────────────────────────────────────────────

const itemSchema = z
  .object({
    id: z.string().nullish(),
    title: z.string().nullish(),
    name: z.string().nullish(),
    permalink: z.string().nullish(),
    url: z.string().nullish(),
    description: z.string().nullish(),
    section: z.string().nullish(),
    pillar: z.string().nullish(),
    domain: z.string().nullish(),
    source_domain: z.string().nullish(),
    relevance: z.number().nullish(),
    source_type: z.string().nullish(),
  })
  .passthrough();

const paginationSchema = z
  .object({
    count: z.number(),
    total: z.number(),
    offset: z.number(),
    has_more: z.boolean(),
    next_offset: z.number().nullable(),
  })
  .passthrough();

// ── Create MCP Server ──────────────────────────────────────────────────

export function createMcpServer(): McpServer {
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  description:
    "Access the ESG Hub knowledge base — ESG articles, curated external resources, glossary terms, reporting frameworks, and the industry taxonomy.",
});

// ── Tool: get_server_info ───────────────────────────────────────────────

server.registerTool(
  "get_server_info",
  {
    title: "Get Server Info",
    description:
      "Use this first to confirm the ESG Hub MCP server is reachable and see its version and API base. It performs one liveness round-trip and returns only server metadata — name, version, API base, tool_count, and healthy — and never fails on an unreachable API: it returns healthy=false rather than an error. For sections, pillars, source domains, or totals use get_esg_metadata.",
    inputSchema: {},
    outputSchema: {
      name: z.string(),
      version: z.string(),
      api_base: z.string(),
      tool_count: z.number(),
      healthy: z.boolean(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  async () => {
    let healthy = true;
    try {
      await apiGet("/meta");
    } catch {
      healthy = false;
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `# ESG Hub MCP Server\n\n- Version: ${SERVER_VERSION}\n- API: ${API_BASE}\n- Tools: ${TOOL_COUNT}\n- Healthy: ${healthy}\n\nUse get_esg_metadata for knowledge-base counts and filter vocabulary.`,
        },
      ],
      structuredContent: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        api_base: API_BASE,
        tool_count: TOOL_COUNT,
        healthy,
      },
    };
  }
);

// ── Tool: search_esg ────────────────────────────────────────────────────

server.registerTool(
  "search_esg",
  {
    title: "Search ESG (keyword)",
    description:
      "Exact keyword (BM25) search across ESG Hub articles and curated external resources. Use when the user supplies a specific term, identifier, or phrase (e.g., 'GRI 305', 'Scope 3'); for paraphrased or conceptual questions prefer search_content, which adds semantic similarity. Terms are matched individually, not as one exact phrase, and `source` narrows to 'pages' (ESG Hub articles) or 'external' (curated third-party URLs). Returns one ranked page of up to `limit` (max 50) items — there is no pagination, so raise `limit` to widen; zero matches returns an empty item list, not an error. Reads are cached ~2 minutes and rate-limited per IP; a 5xx means the API is redeploying — retry shortly.",
    inputSchema: {
      query: z.string().min(1).describe("Search query (e.g., 'carbon emissions', 'GRI standards')"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results"),
      source: z.enum(["all", "pages", "external"]).default("all").describe("Filter by source type"),
    },
    outputSchema: {
      query: z.string(),
      total: z.number(),
      count: z.number(),
      items: z.array(itemSchema),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ query, limit, source }) => {
    try {
      const result = await apiGet<{
        query: string;
        data: Array<{
          id: string;
          title: string;
          permalink?: string;
          url?: string;
          description?: string;
          section?: string;
          source_domain?: string;
          source_type: string;
        }>;
        total: number;
      }>("/search", { q: query, limit: String(limit), source });

      const formatted = result.data
        .map((item, i) => {
          const link = item.permalink ? `${BASE_URL}${item.permalink}` : item.url || "";
          const src = item.source_type === "page" ? `[ESG Hub]` : `[${item.source_domain || "External"}]`;
          return `${i + 1}. **${item.title}** ${src}\n   ${item.description || ""}\n   Link: ${link}`;
        })
        .join("\n\n");

      const empty = result.data.length === 0;
      return {
        content: [
          {
            type: "text" as const,
            text: empty
              ? `No results for "${query}". Try broader terms (e.g., "climate" instead of "climate finance taxonomy"), or list_esg_pages to browse by section.`
              : `Found ${result.total} results for "${query}":\n\n${formatted}`,
          },
        ],
        structuredContent: {
          query,
          total: result.total,
          count: result.data.length,
          items: result.data,
        },
      };
    } catch (err) {
      return mapApiError(err, "Try a different keyword, or list_esg_pages to browse by section.");
    }
  }
);

// ── Tool: search_content ────────────────────────────────────────────────

server.registerTool(
  "search_content",
  {
    title: "Search ESG (hybrid)",
    description:
      "Hybrid search that fuses 384-dim semantic similarity with BM25 and ESG re-ranking across ESG Hub articles and external resources. Use for conceptual or paraphrased questions — natural-language phrases work better than single tokens because `query` is embedded; when the user gives an exact identifier or phrase prefer the cheaper search_esg. `query` must be non-empty and `limit` defaults to 10 and is capped at 50. Returns one ranked page of up to `limit` items, each carrying a fused relevance score (higher is better); there is no pagination, so raise `limit` to widen, and unlike search_esg there is no `source` filter. Zero matches returns an empty item list, not an error. Cached ~2 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      query: z.string().min(1).describe("Search query (e.g., 'carbon emissions', 'board diversity')"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results"),
    },
    outputSchema: {
      query: z.string(),
      mode: z.string(),
      total: z.number(),
      count: z.number(),
      items: z.array(itemSchema),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ query, limit }) => {
    try {
      const result = await apiGet<{
        results: Array<{
          id: string;
          table: string;
          title: string;
          permalink?: string;
          description?: string;
          section?: string;
          relevance?: number;
          source_type?: string;
        }>;
        pagination?: { total: number };
      }>("/search", { mode: "hybrid", q: query, limit: String(limit) });

      const items = result.results ?? [];
      const formatted = items
        .map((item, i) => {
          const link = item.permalink ? `${BASE_URL}${item.permalink}` : "";
          const kind = item.source_type === "external" ? "Resource" : "Article";
          return `${i + 1}. **${item.title}** [${kind}] (score: ${item.relevance ?? "N/A"})\n   ${item.description || ""}\n   Link: ${link}`;
        })
        .join("\n\n");

      const empty = items.length === 0;
      return {
        content: [
          {
            type: "text" as const,
            text: empty
              ? `No hybrid results for "${query}". Try broader terms or use search_esg for BM25-only search.`
              : `Found ${result.pagination?.total ?? items.length} results for "${query}":\n\n${formatted}`,
          },
        ],
        structuredContent: {
          query,
          mode: "hybrid",
          total: result.pagination?.total ?? items.length,
          count: items.length,
          items,
        },
      };
    } catch (err) {
      return mapApiError(err, "Try a different keyword or use search_esg for BM25-only search.");
    }
  }
);

// ── Tool: get_esg_page ──────────────────────────────────────────────────

server.registerTool(
  "get_esg_page",
  {
    title: "Get ESG Article",
    description:
      "Read one ESG Hub article in full, addressed by permalink (e.g., 'standards/gri-101'), bare slug, or record ID ('page:abc123'). Use it once search_esg, search_content, or list_esg_pages has returned an identifier; to fetch a page's neighbours rather than its content use get_related. Returns the complete article body plus section, pillar, keywords, and canonical URL. It resolves only `page` records — a resource URL returns NOT_FOUND — and a redirect-only record resolves to its target; an unknown identifier returns NOT_FOUND. Cached ~10 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      page_id: z
        .string()
        .min(1)
        .describe("Page identifier — permalink path, slug, or record ID (e.g., 'page:abc123')"),
    },
    outputSchema: { page: itemSchema.passthrough() },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  async ({ page_id }) => {
    try {
      const result = await apiGet<{
        data: {
          id: string;
          title: string;
          permalink: string;
          description?: string;
          section?: string;
          pillar?: string;
          content: string;
          keywords?: string;
        };
      }>(`/pages/${encodeURIComponent(page_id)}`);

      const page = result.data;
      const header = [
        `# ${page.title}`,
        page.description ? `\n> ${page.description}` : "",
        `\n**Section:** ${page.section || "N/A"} | **Pillar:** ${page.pillar || "N/A"}`,
        page.keywords ? `**Keywords:** ${page.keywords}` : "",
        `**URL:** ${BASE_URL}${page.permalink}`,
        `\n---\n`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: `${header}\n${page.content}` }],
        structuredContent: { page },
      };
    } catch (err) {
      return mapApiError(
        err,
        "Check the identifier with search_esg or list_esg_pages — permalinks look like 'standards/gri-101'."
      );
    }
  }
);

// ── Tool: list_esg_pages ────────────────────────────────────────────────

server.registerTool(
  "list_esg_pages",
  {
    title: "List ESG Articles",
    description:
      "Enumerate ESG Hub articles, optionally filtered by `section`, `pillar`, or a title substring (`query` — an exact substring, not fuzzy). Use it to browse a whole section; to find articles by meaning use search_content. Results are ordered by section then title and returned one page at a time: pass the response's `next_offset` back as `offset` until `has_more` is false. `section` and `pillar` values must be taken from get_esg_metadata, and `offset` is a raw row count so advance it by `limit`; `limit` caps at 100 (default 20). A filter that matches nothing, or an `offset` past the end, returns an empty item list with `has_more=false`. Cached ~5 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      section: z.string().optional().describe("Filter by section (e.g., 'environmental', 'standards')"),
      pillar: z.string().optional().describe("Filter by pillar (e.g., 'Environmental', 'Standards')"),
      query: z.string().optional().describe("Filter by title substring"),
      limit: z.number().min(1).max(100).default(20).describe("Results per page"),
      offset: z.number().min(0).default(0).describe("Pagination offset — pass the previous next_offset"),
    },
    outputSchema: { items: z.array(itemSchema), pagination: paginationSchema },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ section, pillar, query, limit, offset }) => {
    try {
      const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
      if (section) params.section = section;
      if (pillar) params.pillar = pillar;
      if (query) params.q = query;

      const result = await apiGet<{
        data: Array<{
          id: string;
          title: string;
          permalink: string;
          description?: string;
          section?: string;
          pillar?: string;
        }>;
        pagination: { total: number; limit: number; offset: number; has_more: boolean };
      }>("/pages", params);

      const formatted = result.data
        .map((page, i) => {
          const idx = result.pagination.offset + i + 1;
          return `${idx}. **${page.title}**\n   Section: ${page.section || "N/A"} | Pillar: ${page.pillar || "N/A"}\n   ${page.description || ""}\n   Link: ${BASE_URL}${page.permalink}`;
        })
        .join("\n\n");

      const pag = result.pagination;
      const nextOffset = pag.offset + result.data.length;
      const summary = `Showing ${pag.offset + 1}–${nextOffset} of ${pag.total} pages${pag.has_more ? ` (more available — call again with offset=${nextOffset})` : ""}`;

      return {
        content: [{ type: "text" as const, text: `${summary}\n\n${formatted}` }],
        structuredContent: {
          items: result.data,
          pagination: {
            count: result.data.length,
            total: pag.total,
            offset: pag.offset,
            has_more: pag.has_more,
            next_offset: pag.has_more ? nextOffset : null,
          },
        },
      };
    } catch (err) {
      return mapApiError(err, "Check filter values against get_esg_metadata's section/pillar lists.");
    }
  }
);

// ── Tool: list_esg_resources ────────────────────────────────────────────

server.registerTool(
  "list_esg_resources",
  {
    title: "List External Resources",
    description:
      "Enumerate curated external ESG resources (standards bodies, regulators, tools, databases) with their source URLs, optionally filtered by exact source `domain` or a title substring (`query` — an exact substring, not fuzzy). Use it to assemble authoritative references; for ESG Hub's own articles use list_esg_pages. Results are ordered by title and paged: pass `next_offset` back as `offset`, advancing it by `limit` (a raw row count). `domain` must be a host from get_esg_metadata's domain list; `limit` caps at 100 (default 20). A filter that matches nothing, or an `offset` past the end, returns an empty item list with `has_more=false`. Cached ~5 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      domain: z.string().optional().describe("Filter by source domain (e.g., 'ghgprotocol.org')"),
      query: z.string().optional().describe("Filter by title substring"),
      limit: z.number().min(1).max(100).default(20).describe("Results per page"),
      offset: z.number().min(0).default(0).describe("Pagination offset — pass the previous next_offset"),
    },
    outputSchema: { items: z.array(itemSchema), pagination: paginationSchema },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ domain, query, limit, offset }) => {
    try {
      const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
      if (domain) params.domain = domain;
      if (query) params.q = query;

      const result = await apiGet<{
        data: Array<{
          id: string;
          title: string;
          url: string;
          domain: string;
          description?: string;
          content?: string;
        }>;
        pagination: { total: number; limit: number; offset: number; has_more: boolean };
      }>("/resources", params);

      const formatted = result.data
        .map((res, i) => {
          const idx = result.pagination.offset + i + 1;
          return `${idx}. **${res.title}** [${res.domain}]\n   ${res.description || res.content?.slice(0, 150) || ""}\n   URL: ${res.url}`;
        })
        .join("\n\n");

      const pag = result.pagination;
      const nextOffset = pag.offset + result.data.length;
      const summary = `Showing ${pag.offset + 1}–${nextOffset} of ${pag.total} resources${pag.has_more ? ` (more available — call again with offset=${nextOffset})` : ""}`;

      return {
        content: [{ type: "text" as const, text: `${summary}\n\n${formatted}` }],
        structuredContent: {
          items: result.data,
          pagination: {
            count: result.data.length,
            total: pag.total,
            offset: pag.offset,
            has_more: pag.has_more,
            next_offset: pag.has_more ? nextOffset : null,
          },
        },
      };
    } catch (err) {
      return mapApiError(err, "Check domain names against get_esg_metadata's source-domain list.");
    }
  }
);

// ── Tool: get_esg_metadata ──────────────────────────────────────────────

server.registerTool(
  "get_esg_metadata",
  {
    title: "Get Knowledge Base Stats",
    description:
      "Discover the filter vocabulary for the knowledge base: total counts plus the exact `section`, `pillar`, and source-`domain` values with their counts. Call it before list_esg_pages or list_esg_resources so filters match real values; for server version and health use get_server_info. It takes no parameters, returns a single object (never paginated), and the lists are seeded reference values that change only on deploy, so they can be cached within a session. Cached ~10 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {},
    outputSchema: {
      stats: z.record(z.string(), z.number()),
      sections: z.array(z.record(z.string(), z.unknown())),
      pillars: z.array(z.record(z.string(), z.unknown())),
      domains: z.array(z.record(z.string(), z.unknown())),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  async () => {
    try {
      const result = await apiGet<{
        stats: {
          total_pages: number;
          total_resources: number;
          total_sections: number;
          total_pillars: number;
          total_domains: number;
        };
        sections: Array<{ name: string; page_count: number }>;
        pillars: Array<{ name: string; page_count: number }>;
        domains: Array<{ name: string; resource_count: number }>;
      }>("/meta");

      const stats = result.stats;
      const sectionsStr = result.sections.map((s) => `  - ${s.name}: ${s.page_count} pages`).join("\n");
      const pillarsStr = result.pillars.map((p) => `  - ${p.name}: ${p.page_count} pages`).join("\n");
      const domainsStr = result.domains.slice(0, 20).map((d) => `  - ${d.name}: ${d.resource_count} resources`).join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `# ESG Hub Knowledge Base Statistics

**Total Pages:** ${stats.total_pages}
**Total External Resources:** ${stats.total_resources}
**Sections:** ${stats.total_sections}
**Pillars:** ${stats.total_pillars}
**Source Domains:** ${stats.total_domains}

## Sections
${sectionsStr}

## Pillars
${pillarsStr}

## Top Source Domains
${domainsStr}`,
          },
        ],
        structuredContent: {
          stats: result.stats,
          sections: result.sections,
          pillars: result.pillars,
          domains: result.domains,
        },
      };
    } catch (err) {
      return mapApiError(err, "The metadata endpoint should always be available — retry in a few seconds.");
    }
  }
);

// ── Tool: get_term ──────────────────────────────────────────────────────

server.registerTool(
  "get_term",
  {
    title: "Get Glossary Term",
    description:
      "Look up one glossary term by record ID ('term:abc123'), permalink, or exact name and return its full definition and facets. Use it when the user asks 'what is <term>'; to find terms by topic, or across all content, use search_esg or search_content, and to survey the glossary use list_terms. Name matching is exact (case-insensitive) with no fuzzy or partial matching, and it returns a single term, never a list. The `definition` field is the authoritative text and `facets` carries the topic/content_type classification; an unknown identifier returns NOT_FOUND. Cached ~10 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      term_id: z
        .string()
        .min(1)
        .describe("Term identifier — slug/name (e.g., 'materiality') or record ID (e.g., 'term:abc123')"),
    },
    outputSchema: { term: itemSchema.passthrough() },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  async ({ term_id }) => {
    try {
      const termResult = await apiGet<{
        data: {
          id: string;
          name: string;
          definition: string;
          section?: string;
          pillar?: string;
          permalink?: string;
          facets?: unknown;
        };
      }>(`/terms/${encodeURIComponent(term_id)}`);

      const term = termResult.data;

      const text = [
        `# ${term.name}`,
        term.section ? `**Section:** ${term.section}` : "",
        `\n## Definition`,
        term.definition,
        term.facets ? `\n## Facets\n\`\`\`json\n${JSON.stringify(term.facets, null, 2)}\n\`\`\`` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { term },
      };
    } catch (err) {
      return mapApiError(
        err,
        "Check the term identifier with search_esg or list_esg_pages — names look like 'materiality'."
      );
    }
  }
);

// ── Tool: get_related ────────────────────────────────────────────────────

server.registerTool(
  "get_related",
  {
    title: "Get Related Content",
    description:
      "Traverse the ESG Hub knowledge graph one hop from a page and return every connected record grouped by edge type. Use it after get_esg_page when you need neighbouring concepts; to read a page's own content use get_esg_page. Returns at most 15 related pages and, today, only `related_pages` edges; a page with no links returns an empty group list, not an error. There is no pagination. `record_id` accepts a `page:` record ID or a permalink; `edge_type` filters the result to one edge type (default: all). Cached ~10 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      record_id: z.string().min(1).describe("Page record ID (e.g., 'page:abc123') or permalink/slug"),
      edge_type: z.string().optional().describe("Optional filter: only return edges of this type"),
    },
    outputSchema: {
      record_id: z.string(),
      total: z.number(),
      edge_types: z.array(z.string()),
      edges_grouped: z.record(z.string(), z.array(itemSchema)),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ record_id, edge_type }) => {
    try {
      const result = await apiGet<{
        data: Array<{
          id: string;
          title: string;
          permalink?: string;
          description?: string;
          section?: string;
          edge_type?: string;
        }>;
      }>(`/pages/${encodeURIComponent(record_id)}/related`);

      let edges = result.data ?? [];
      if (edge_type) {
        edges = edges.filter((e) => (e.edge_type || "related_pages") === edge_type);
      }

      const groups: Record<string, typeof edges> = {};
      for (const edge of edges) {
        const type = edge.edge_type || "related_pages";
        (groups[type] ??= []).push(edge);
      }

      const groupText = Object.entries(groups)
        .map(([type, items]) => {
          const lines = items.map(
            (e) =>
              `  - **${e.title}** (${e.section || "N/A"})${e.permalink ? ` → ${BASE_URL}${e.permalink}` : ""}`
          );
          return `### ${type} (${items.length})\n${lines.join("\n")}`;
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              edges.length === 0
                ? `No related records found for "${record_id}".`
                : `# Related to "${record_id}"\n\n${groupText}`,
          },
        ],
        structuredContent: {
          record_id,
          total: edges.length,
          edge_types: Object.keys(groups),
          edges_grouped: groups,
        },
      };
    } catch (err) {
      return mapApiError(err, "Ensure the record_id is a valid page record ID or permalink.");
    }
  }
);

// ── Tool: list_frameworks ────────────────────────────────────────────────

server.registerTool(
  "list_frameworks",
  {
    title: "List Reporting Frameworks",
    description:
      "Enumerate the ESG reporting frameworks and standards the knowledge base covers (GRI, SASB/ISSB, TCFD, ESRS, CDP, TNFD, …), with each framework's abbreviation, description, and official website. Use it to discover coverage; for the ESG Hub articles that explain a standard use list_esg_pages with section='standards'. Results are ordered by name and paged: pass `next_offset` back as `offset`, a raw row count so advance it by `limit`; `limit` defaults to 20 and is capped at 100. An `offset` past the end returns an empty `items` list with `has_more=false`. Cached ~10 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      limit: z.number().min(1).max(100).default(20).describe("Results per page"),
      offset: z.number().min(0).default(0).describe("Pagination offset — pass the previous next_offset"),
    },
    outputSchema: { items: z.array(itemSchema), pagination: paginationSchema },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ limit, offset }) => {
    try {
      const result = await apiGet<{
        items: Array<{
          id: string;
          name: string;
          abbreviation?: string;
          description?: string;
          website?: string;
          section?: string;
        }>;
        pagination: { total: number; limit: number; offset: number; has_more: boolean };
      }>("/frameworks", { limit: String(limit), offset: String(offset) });

      const frameworks = result.items ?? [];
      const formatted = frameworks
        .map((fw, i) => {
          const idx = result.pagination.offset + i + 1;
          const abbr = fw.abbreviation ? ` (${fw.abbreviation})` : "";
          const link = fw.website ? `\n   Link: ${fw.website}` : "";
          return `${idx}. **${fw.name}**${abbr}\n   ${fw.description?.slice(0, 160) || "N/A"}${link}`;
        })
        .join("\n\n");

      const pag = result.pagination;
      const nextOffset = pag.offset + frameworks.length;
      const summary = `Showing ${pag.offset + 1}–${nextOffset} of ${pag.total} frameworks${pag.has_more ? ` (more available — call again with offset=${nextOffset})` : ""}`;

      return {
        content: [{ type: "text" as const, text: `${summary}\n\n${formatted}` }],
        structuredContent: {
          items: frameworks,
          pagination: {
            count: frameworks.length,
            total: pag.total,
            offset: pag.offset,
            has_more: pag.has_more,
            next_offset: pag.has_more ? nextOffset : null,
          },
        },
      };
    } catch (err) {
      return mapApiError(err, "The frameworks endpoint should always be available — retry in a few seconds.");
    }
  }
);

// ── Tool: list_industries ───────────────────────────────────────────────

server.registerTool(
  "list_industries",
  {
    title: "List Industries",
    description:
      "Return the ESG Hub industry taxonomy (IFRS/SASB-style): every industry with its stable `industry_id`, English/Chinese names, and the `sector_id` it belongs to. Use it to obtain valid industry values for tag_content or to group coverage by sector; for article sections and source domains use get_esg_metadata. It takes no parameters and returns the complete taxonomy in one response (no pagination). The taxonomy is seeded reference data, not derived from articles, so it is stable across sessions and cached ~10 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {},
    outputSchema: {
      count: z.number(),
      industries: z.array(itemSchema),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  async () => {
    try {
      const result = await apiGet<{
        items: Array<{
          id: string;
          industry_id: string;
          name_en: string;
          name_zh?: string;
          name_zh_tw?: string;
          sector_id: string;
        }>;
        pagination: { total: number };
      }>("/industries", { limit: "200" });

      const industries = result.items ?? [];
      const sectors = [...new Set(industries.map((i) => i.sector_id))];
      const text = [
        "# ESG Hub Industry Taxonomy",
        `\n${industries.length} industries across ${sectors.length} sectors:\n`,
        ...industries.map((ind) => `- **${ind.name_en}** (${ind.sector_id})`),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { count: industries.length, industries },
      };
    } catch (err) {
      return mapApiError(err, "The industries endpoint should always be available — retry in a few seconds.");
    }
  }
);

// ── Tool: list_terms ────────────────────────────────────────────────────

server.registerTool(
  "list_terms",
  {
    title: "List Glossary Terms",
    description:
      "Enumerate glossary terms, optionally filtered by an exact name substring (`query` — case-insensitive, not fuzzy). Use it to survey the glossary or page through terminology; to fetch one term's definition use get_term, and to search all content use search_esg or search_content. Results are ordered by name and paged: pass `next_offset` back as `offset` (a raw row count, so advance it by `limit`); `limit` defaults to 20 and is capped at 100. A query that matches nothing, or an `offset` past the end, returns an empty item list with `has_more=false`. Cached ~10 minutes; rate-limited per IP; retry on 5xx.",
    inputSchema: {
      query: z.string().max(200).optional().describe("Filter by name substring (case-insensitive)"),
      limit: z.number().min(1).max(100).default(20).describe("Results per page"),
      offset: z.number().min(0).default(0).describe("Pagination offset — pass the previous next_offset"),
    },
    outputSchema: { items: z.array(itemSchema), pagination: paginationSchema },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ query, limit, offset }) => {
    try {
      const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
      if (query) params.q = query;

      const result = await apiGet<{
        items: Array<{ id: string; name: string; definition?: string; section?: string }>;
        pagination: { total: number; limit: number; offset: number; has_more: boolean };
      }>("/terms", params);

      const terms = result.items ?? [];
      const formatted = terms
        .map((t, i) => {
          const idx = result.pagination.offset + i + 1;
          const def = (t.definition || "").slice(0, 140);
          return `${idx}. **${t.name}**\n   ${def}${t.definition && t.definition.length > 140 ? "…" : ""}`;
        })
        .join("\n\n");

      const pag = result.pagination;
      const nextOffset = pag.offset + terms.length;
      const summary = `Showing ${pag.offset + 1}–${nextOffset} of ${pag.total} terms${pag.has_more ? ` (more available — call again with offset=${nextOffset})` : ""}`;

      return {
        content: [
          {
            type: "text" as const,
            text: terms.length === 0
              ? `No glossary terms match${query ? ` "${query}"` : ""}.`
              : `${summary}\n\n${formatted}`,
          },
        ],
        structuredContent: {
          items: terms,
          pagination: {
            count: terms.length,
            total: pag.total,
            offset: pag.offset,
            has_more: pag.has_more,
            next_offset: pag.has_more ? nextOffset : null,
          },
        },
      };
    } catch (err) {
      return mapApiError(err, "The terms endpoint should always be available — retry in a few seconds.");
    }
  }
);

// ── Tool: propose_term ──────────────────────────────────────────────────

server.registerTool(
  "propose_term",
  {
    title: "Propose Glossary Term",
    description:
      "Submit a new glossary term for human review. Nothing is published immediately: the call creates a pending proposal and returns a `proposal_id`; a reviewer decides whether it goes live, and only an approved term later appears in get_term. Use it only when the user explicitly wants to contribute a term; to look one up use get_term. `name` is the display name and `definition` must be at least 10 characters; `facets` is optional and its values should come from get_esg_metadata / list_industries vocabularies. Requires a write token in ESG_HUB_WRITE_TOKEN — a missing or invalid token returns 401 — and calls are rate-limited.",
    inputSchema: {
      name: z.string().min(1).max(200).describe("The glossary term name (e.g., 'Materiality Assessment')"),
      definition: z.string().min(10).max(5000).describe("Full definition of the term (min 10 characters)"),
      facets: z
        .object({
          topic: z.array(z.string()).optional().describe("Topic areas"),
          industry: z.array(z.string()).optional().describe("Relevant industries"),
          framework: z.array(z.string()).optional().describe("Related frameworks/standards"),
          jurisdiction: z.array(z.string()).optional().describe("Relevant jurisdictions"),
          stakeholder: z.array(z.string()).optional().describe("Affected stakeholder groups"),
          content_type: z.string().optional().describe("Content classification"),
        })
        .optional()
        .describe("Optional metadata facets for the term"),
    },
    outputSchema: { proposal_id: z.string(), status: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ name, definition, facets }) => {
    try {
      const body: Record<string, unknown> = { name, definition };
      if (facets) body.facets = facets;

      const result = await apiPost<{ proposal_id: string; status: string }>("/terms", body);

      return {
        content: [
          {
            type: "text" as const,
            text: `Term proposal submitted: **${name}**\n\nProposal ID: ${result.proposal_id}\nStatus: ${result.status}\n\nYour proposal will be reviewed before publication.`,
          },
        ],
        structuredContent: { proposal_id: result.proposal_id, status: result.status },
      };
    } catch (err) {
      return mapWriteError(err, "Ensure name and definition are provided and the term doesn't already exist.");
    }
  }
);

// ── Tool: tag_content ────────────────────────────────────────────────────

server.registerTool(
  "tag_content",
  {
    title: "Tag Content Facets",
    description:
      "Replace the facet tags on one existing ESG Hub page: `topic`, `industry`, `framework`, `jurisdiction`, `stakeholder`, and `content_type`. The supplied `facets` object replaces the page's facet set, so any facet key you omit is cleared; the page body and title are never changed or deleted. The response echoes the page's new `facets` and `updated_at`. The array facets (`topic`, `industry`, `framework`, `jurisdiction`, `stakeholder`) each accept multiple values, while `content_type` is a single string; values are validated against the vocabulary from get_esg_metadata / list_industries, and an unrecognised value or key is rejected with 400. Give `page_id` as a permalink, slug, or record ID — permalinks are resolved to the underlying record server-side. Use it to curate tags; to read a page use get_esg_page, and to queue a removal use flag_content. Requires ESG_HUB_WRITE_TOKEN; rate-limited.",
    inputSchema: {
      page_id: z.string().min(1).describe("Page permalink, slug, or record ID (e.g., 'page:abc123')"),
      facets: z
        .object({
          topic: z.array(z.string()).optional().describe("Topic classifications"),
          industry: z.array(z.string()).optional().describe("Relevant industry sectors"),
          framework: z.array(z.string()).optional().describe("Related ESG frameworks/standards"),
          jurisdiction: z.array(z.string()).optional().describe("Applicable jurisdictions"),
          stakeholder: z.array(z.string()).optional().describe("Stakeholder groups affected"),
          content_type: z.string().optional().describe("Content type (e.g., 'guide', 'reference')"),
        })
        .describe("Facet tags to apply to the page"),
    },
    outputSchema: {
      page_id: z.string(),
      title: z.string(),
      facets: z.record(z.string(), z.unknown()),
      updated_at: z.string().nullable(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ page_id, facets }) => {
    try {
      // Resolve a permalink/slug to the SurrealDB record ID the facets route requires.
      let recordId = page_id;
      if (!recordId.startsWith("page:")) {
        const page = await apiGet<{ data: { id: string } }>(`/pages/${encodeURIComponent(page_id)}`);
        recordId = page.data.id;
      }

      const result = await apiPatch<{
        data: {
          id: string;
          title: string;
          facets: Record<string, unknown>;
          updated_at?: string;
        };
      }>(`/pages/${encodeURIComponent(recordId)}/facets`, { facets });

      const page = result.data;
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Facets updated for **${page.title}** (${page.id})`,
              page.updated_at ? `Updated at: ${page.updated_at}` : "",
              `\nNew facets:\n\`\`\`json\n${JSON.stringify(page.facets, null, 2)}\n\`\`\``,
            ].join("\n"),
          },
        ],
        structuredContent: {
          page_id: page.id,
          title: page.title,
          facets: page.facets,
          updated_at: page.updated_at || null,
        },
      };
    } catch (err) {
      return mapWriteError(err, "Verify the page_id exists and the facets object is valid.");
    }
  }
);

// ── Tool: flag_content ──────────────────────────────────────────────────

server.registerTool(
  "flag_content",
  {
    title: "Flag Content for Curation",
    description:
      "Queue one ESG Hub page for human curation — delist, remove, or review — with a reason. Nothing changes immediately: the call records a pending request and returns a `proposal_id`; the page is not modified until a curator approves it. Use it when an article is outdated, duplicated, or inaccurate; to edit its facet tags instead use tag_content. `action` controls the requested outcome: `delist` hides the page from listings, `remove` deletes it, and `review` (the default) flags it for a curator to decide. Give `page_id` as a permalink, slug, or record ID (resolved server-side) and a `reason` of at least 10 characters. Requires ESG_HUB_WRITE_TOKEN; rate-limited.",
    inputSchema: {
      page_id: z.string().min(1).describe("Page permalink, slug, or record ID (e.g., 'page:abc123')"),
      reason: z.string().min(10).max(1000).describe("Why the page should be curated (min 10 characters)"),
      action: z
        .enum(["delist", "remove", "review"])
        .default("review")
        .describe("Requested outcome: delist (hide from listings), remove (delete), or review (default)"),
    },
    outputSchema: { proposal_id: z.string(), status: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  async ({ page_id, reason, action }) => {
    try {
      // Resolve a permalink/slug to the SurrealDB record ID the API expects.
      let recordId = page_id;
      if (!recordId.startsWith("page:")) {
        const page = await apiGet<{ data: { id: string } }>(`/pages/${encodeURIComponent(page_id)}`);
        recordId = page.data.id;
      }

      const result = await apiPost<{ proposal_id: string; status: string }>(
        `/pages/${encodeURIComponent(recordId)}/flag`,
        { action, reason }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Curation request queued for **${recordId}**\n\nAction: ${action}\nProposal ID: ${result.proposal_id}\nStatus: ${result.status}\n\nA curator will review it before any change is made.`,
          },
        ],
        structuredContent: { proposal_id: result.proposal_id, status: result.status },
      };
    } catch (err) {
      return mapWriteError(err, "Verify the page_id exists and the reason is at least 10 characters.");
    }
  }
);

// ── Resources ───────────────────────────────────────────────────────────

server.resource(
  "esg-hub-api-docs",
  "esg-hub://api-docs",
  {
    description: "ESG Hub REST API documentation with endpoints, parameters, and examples",
    mimeType: "text/markdown",
  },
  async () => ({
    contents: [
      {
        uri: "esg-hub://api-docs",
        mimeType: "text/markdown",
        text: `# ESG Hub REST API Documentation

Base URL: ${BASE_URL}/api/v1

## Endpoints

### GET /api/v1/meta
Returns database metadata (sections, pillars, domains, stats).

### GET /api/v1/pages
List pages with filtering and pagination (\`section\`, \`pillar\`, \`q\`, \`limit\`, \`offset\`).

### GET /api/v1/pages/:id
Get a single page by ID, permalink, or slug.

### GET /api/v1/pages/:id/related
Related pages for a page.

### GET /api/v1/resources
List external resources (\`domain\`, \`q\`, \`limit\`, \`offset\`).

### GET /api/v1/terms
List glossary terms (\`q\`, \`limit\`, \`offset\`).

### GET /api/v1/terms/:id
Get a single glossary term by record ID, permalink, or name.

### GET /api/v1/frameworks
List reporting frameworks and standards.

### GET /api/v1/industries
List the industry taxonomy grouped by sector.

### GET /api/v1/search?q=query
Full-text keyword search (BM25). Add \`mode=hybrid\` for semantic + keyword fusion.
- \`q\`: query (required) · \`limit\`: max 50 · \`source\`: "all" | "pages" | "external"

### POST /api/v1/search
Semantic vector search. Body: \`{ embedding: number[384], k?, source? }\`.

## CORS
All endpoints support CORS.
`,
      },
    ],
  })
);

return server;
}

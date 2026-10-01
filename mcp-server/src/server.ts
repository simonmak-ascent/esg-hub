import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BASE_URL = process.env.ESG_HUB_API_URL || "https://esg-hub.ascent.partners";
const API_BASE = process.env.ESG_HUB_API_BASE || BASE_URL;
const WRITE_TOKEN = process.env.ESG_HUB_WRITE_TOKEN || "";
const SERVER_NAME = "esg-hub";
const SERVER_VERSION = "1.3.0";

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
      "Use this first to confirm the server version, API endpoint, and knowledge-base size before choosing other tools. Returns server name, version, API base, and aggregate stats (pages, resources, sections, pillars, domains). Read-only; it reads no content.",
    inputSchema: {},
    outputSchema: {
      name: z.string(),
      version: z.string(),
      api_base: z.string(),
      stats: z.record(z.string(), z.number()),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  async () => {
    try {
      const meta = await apiGet<{ stats: Record<string, number> }>("/meta");
      const s = meta.stats;
      return {
        content: [
          {
            type: "text" as const,
            text: `# ESG Hub MCP Server\n\n- Version: ${SERVER_VERSION}\n- API: ${API_BASE}\n- Pages: ${s.total_pages}\n- External resources: ${s.total_resources}\n- Sections: ${s.total_sections}\n- Pillars: ${s.total_pillars}\n- Source domains: ${s.total_domains}`,
          },
        ],
        structuredContent: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
          api_base: API_BASE,
          stats: s,
        },
      };
    } catch (err) {
      return mapApiError(err, "The metadata endpoint should always be available — retry in a few seconds.");
    }
  }
);

// ── Tool: search_esg ────────────────────────────────────────────────────

server.registerTool(
  "search_esg",
  {
    title: "Search ESG (keyword)",
    description:
      "Full-text keyword (BM25) search across all ESG Hub articles and external resources. Use for exact term or keyword lookups; for nuanced/conceptual queries that benefit from semantic similarity, use search_content instead. Returns ranked results with title, link, snippet, and source type.",
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
      "Hybrid semantic + keyword search across all ESG Hub content (vector similarity + BM25 with ESG re-ranking). Use for nuanced or conceptual queries; for exact keyword/phrase lookups use search_esg. Results are ranked by a fused relevance score.",
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
      "Retrieve the full content of one ESG Hub article by permalink, slug, or record ID. Use after search_esg, search_content, or list_esg_pages to read a specific article. Returns section, pillar, keywords, and canonical URL. Read-only and idempotent.",
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
      "List and filter ESG Hub articles by section, pillar, or title substring. Use to browse the knowledge base or enumerate a domain. Returns paginated results; pass the response's next_offset as offset to get the next page. Call get_esg_metadata first to discover valid section/pillar values.",
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
      "List curated external ESG resources (standards bodies, regulations, tools, databases) with source URLs. Use to find authoritative references by domain or title. Returns paginated results; pass next_offset as offset to page. Call get_esg_metadata first for valid domain values.",
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
      "Get ESG Hub knowledge-base statistics and the full lists of sections, pillars, and source domains with counts. Use before filtering with list_esg_pages or list_esg_resources to discover valid filter values. Read-only and idempotent.",
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
      "Fetch a glossary term by record ID, permalink, or name. Use when the user asks about specific ESG terminology; to search for terms by topic use search_esg or search_content. Returns the full definition and facets. Read-only and idempotent.",
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
      "Traverse the ESG Hub knowledge graph from a page (record ID or permalink) and return connected records grouped by edge type. Use to explore how concepts interconnect; to read a page's content use get_esg_page. Read-only.",
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
      "List ESG reporting frameworks and standards (GRI, SASB, TCFD, ESRS, CDP, etc.). Use to discover which frameworks the knowledge base covers; for related article content use list_esg_pages with section='standards'. Paginated.",
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
      "List the ESG Hub industry taxonomy (IFRS/SASB-style), grouped by sector. Use to discover valid industry values for tagging and filtering. Read-only and idempotent.",
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

// ── Tool: propose_term ──────────────────────────────────────────────────

server.registerTool(
  "propose_term",
  {
    title: "Propose Glossary Term",
    description:
      "Submit a new glossary term proposal for human review before publication. Use only when the user wants to contribute a term; this is a write that requires a valid token in ESG_HUB_WRITE_TOKEN. Returns the proposal ID and status.",
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
      "Update the facet tags on an existing ESG Hub page (permalink, slug, or record ID). Facets drive filtering, discoverability, and graph navigation. Use only to change tags; to read a page use get_esg_page. Write — requires ESG_HUB_WRITE_TOKEN.",
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

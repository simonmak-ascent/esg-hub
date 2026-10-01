#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const BASE_URL = process.env.ESG_HUB_API_URL || "https://esg-hub.ascent.partners";
const API_BASE = process.env.ESG_HUB_API_BASE || BASE_URL;
const WRITE_TOKEN = process.env.ESG_HUB_WRITE_TOKEN || "";
/**
 * Helper to call the ESG Hub REST API
 */
class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}
async function apiGet(path, params) {
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
    return res.json();
}
async function apiPost(path, body) {
    const url = new URL(`/api/v1${path}`, API_BASE);
    const headers = {
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
            if (json.error)
                detail = json.error;
            else if (json.message)
                detail = json.message;
        }
        catch {
            /* ignore parse failure */
        }
        throw new ApiError(res.status, `API error: ${res.status} ${detail}`);
    }
    return res.json();
}
async function apiPatch(path, body) {
    const url = new URL(`/api/v1${path}`, API_BASE);
    const headers = {
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
            if (json.error)
                detail = json.error;
            else if (json.message)
                detail = json.message;
        }
        catch {
            /* ignore parse failure */
        }
        throw new ApiError(res.status, `API error: ${res.status} ${detail}`);
    }
    return res.json();
}
/**
 * Structured error envelope per MCP best practice (AC-B3).
 */
function toolError(code, message, retryable, hint) {
    return {
        content: [{ type: "text", text: `${message}\n\nHint: ${hint}` }],
        isError: true,
        structuredContent: {
            error: { code, message, retryable, hint },
        },
    };
}
function mapApiError(err, notFoundHint) {
    if (err instanceof ApiError) {
        if (err.status === 404) {
            return toolError("NOT_FOUND", "The requested item was not found.", false, notFoundHint);
        }
        const retryable = err.status >= 500;
        return toolError("UPSTREAM_ERROR", `The ESG Hub API returned an error (HTTP ${err.status}).`, retryable, retryable
            ? "Retry in a few seconds; if it persists, the API may be redeploying."
            : "Check the request parameters and try again.");
    }
    return toolError("UPSTREAM_ERROR", `Could not reach the ESG Hub API (${String(err)}).`, true, "Check network connectivity and try again.");
}
function mapWriteError(err, notFoundHint) {
    if (err instanceof ApiError) {
        if (err.status === 401) {
            return toolError("UNAUTHORIZED", "The write token is missing, expired, or invalid.", false, "Set ESG_HUB_WRITE_TOKEN to a valid API write token and retry.");
        }
        if (err.status === 429) {
            return toolError("RATE_LIMITED", "Too many write requests — rate limit hit.", true, "Wait a few seconds before retrying.");
        }
        if (err.status === 400) {
            return toolError("BAD_REQUEST", `Invalid request: ${err.message}`, false, "Check the input parameters and try again.");
        }
    }
    return mapApiError(err, notFoundHint || "Re-check your inputs and try again.");
}
// ── Create MCP Server ──────────────────────────────────────────────────
const server = new McpServer({
    name: "esg-hub",
    version: "1.3.0",
    description: "Access the ESG Hub knowledge base — ESG articles, curated external resources, glossary terms, reporting frameworks, and the industry taxonomy.",
});
// ── Tool: search_esg ────────────────────────────────────────────────────
server.tool("search_esg", "Full-text keyword search across all ESG Hub articles and curated external resources (BM25 ranking). Use when the user asks to find ESG information by topic or keyword (e.g., 'carbon emissions', 'board diversity', 'GRI standards'). Returns ranked results with title, link, snippet, and source type.", {
    query: z.string().min(1).describe("Search query (e.g., 'carbon emissions', 'board diversity', 'GRI standards')"),
    limit: z.number().min(1).max(50).default(10).describe("Maximum number of results to return"),
    source: z.enum(["all", "pages", "external"]).default("all").describe("Filter results by source type"),
}, { readOnlyHint: true, openWorldHint: false }, async ({ query, limit, source }) => {
    try {
        const result = await apiGet("/search", { q: query, limit: String(limit), source });
        const formatted = result.data
            .map((item, i) => {
            const link = item.permalink
                ? `${BASE_URL}${item.permalink}`
                : item.url || "";
            const src = item.source_type === "page" ? `[ESG Hub]` : `[${item.source_domain || "External"}]`;
            return `${i + 1}. **${item.title}** ${src}\n   ${item.description || ""}\n   Link: ${link}`;
        })
            .join("\n\n");
        const empty = result.data.length === 0;
        return {
            content: [
                {
                    type: "text",
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
    }
    catch (err) {
        return mapApiError(err, "Try a different keyword, or list_esg_pages to browse by section.");
    }
});
// ── Tool: get_esg_page ──────────────────────────────────────────────────
server.tool("get_esg_page", "Retrieve the full content of one ESG Hub article. Use when you have a specific page identifier from search_esg or list_esg_pages. Returns the complete article text with section, pillar, keywords, and canonical URL.", {
    page_id: z
        .string()
        .min(1)
        .describe("Page identifier — can be a permalink path (e.g., 'environmental/climate-change'), a slug (e.g., 'climate-change'), or a SurrealDB record ID (e.g., 'page:abc123')"),
}, { readOnlyHint: true, openWorldHint: false, idempotentHint: true }, async ({ page_id }) => {
    try {
        const result = await apiGet(`/pages/${encodeURIComponent(page_id)}`);
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
            content: [
                {
                    type: "text",
                    text: `${header}\n${page.content}`,
                },
            ],
            structuredContent: { page },
        };
    }
    catch (err) {
        return mapApiError(err, "Check the identifier with search_esg or list_esg_pages — permalinks look like 'standards/gri-101'.");
    }
});
// ── Tool: list_esg_pages ────────────────────────────────────────────────
server.tool("list_esg_pages", "List and filter ESG Hub articles by section, pillar, or title substring. Use to browse the knowledge base structure or enumerate articles in a domain. Returns paginated results with pagination metadata (has_more, next_offset) for chaining.", {
    section: z
        .string()
        .optional()
        .describe("Filter by section (e.g., 'environmental', 'social', 'governance', 'standards', 'sdg', 'frameworks', 'finance', 'hk-apac', 'emerging-topics', 'learning', 'ratings', 'regulations')"),
    pillar: z
        .string()
        .optional()
        .describe("Filter by pillar (e.g., 'Environmental', 'Social', 'Governance', 'Standards', 'SDGs', 'Knowledge Base', 'Regional', 'Learn')"),
    query: z.string().optional().describe("Filter by title substring"),
    limit: z.number().min(1).max(100).default(20).describe("Number of results per page (use with offset for paging)"),
    offset: z.number().min(0).default(0).describe("Pagination offset — pass the previous response's next_offset to get the next page"),
}, { readOnlyHint: true, openWorldHint: false }, async ({ section, pillar, query, limit, offset }) => {
    try {
        const params = {
            limit: String(limit),
            offset: String(offset),
        };
        if (section)
            params.section = section;
        if (pillar)
            params.pillar = pillar;
        if (query)
            params.q = query;
        const result = await apiGet("/pages", params);
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
            content: [
                {
                    type: "text",
                    text: `${summary}\n\n${formatted}`,
                },
            ],
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
    }
    catch (err) {
        return mapApiError(err, "Check filter values against get_esg_metadata's section/pillar lists.");
    }
});
// ── Tool: list_esg_resources ────────────────────────────────────────────
server.tool("list_esg_resources", "List curated external ESG resources (standards bodies, regulations, tools, databases) with their source URLs. Use to find authoritative external references by domain or title. Returns paginated results with pagination metadata (has_more, next_offset).", {
    domain: z
        .string()
        .optional()
        .describe("Filter by source domain (e.g., 'ghgprotocol.org', 'eur-lex.europa.eu', 'www.cdp.net', 'tnfd.global', 'environment.ec.europa.eu')"),
    query: z.string().optional().describe("Filter by title substring"),
    limit: z.number().min(1).max(100).default(20).describe("Number of results per page (use with offset for paging)"),
    offset: z.number().min(0).default(0).describe("Pagination offset — pass the previous response's next_offset to get the next page"),
}, { readOnlyHint: true, openWorldHint: false }, async ({ domain, query, limit, offset }) => {
    try {
        const params = {
            limit: String(limit),
            offset: String(offset),
        };
        if (domain)
            params.domain = domain;
        if (query)
            params.q = query;
        const result = await apiGet("/resources", params);
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
            content: [
                {
                    type: "text",
                    text: `${summary}\n\n${formatted}`,
                },
            ],
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
    }
    catch (err) {
        return mapApiError(err, "Check domain names against get_esg_metadata's source-domain list.");
    }
});
// ── Tool: get_esg_metadata ──────────────────────────────────────────────
server.tool("get_esg_metadata", "Get ESG Hub knowledge base statistics: total pages/resources, and the full lists of sections, pillars, and source domains with counts. Use before filtering with list_esg_pages or list_esg_resources to discover valid filter values.", {}, { readOnlyHint: true, openWorldHint: false, idempotentHint: true }, async () => {
    try {
        const result = await apiGet("/meta");
        const stats = result.stats;
        const sectionsStr = result.sections
            .map((s) => `  - ${s.name}: ${s.page_count} pages`)
            .join("\n");
        const pillarsStr = result.pillars
            .map((p) => `  - ${p.name}: ${p.page_count} pages`)
            .join("\n");
        const domainsStr = result.domains
            .slice(0, 20)
            .map((d) => `  - ${d.name}: ${d.resource_count} resources`)
            .join("\n");
        return {
            content: [
                {
                    type: "text",
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
            structuredContent: result,
        };
    }
    catch (err) {
        return mapApiError(err, "The metadata endpoint should always be available — retry in a few seconds.");
    }
});
// ── Tool: search_content ────────────────────────────────────────────────
server.tool("search_content", "Hybrid semantic + keyword search across all ESG Hub content. Combines vector similarity (384-dim BGE embeddings) with BM25 full-text scoring for higher-quality results than keyword-only search. Use for nuanced ESG queries.", {
    query: z.string().min(1).describe("Search query (e.g., 'carbon emissions', 'board diversity', 'GRI standards')"),
    limit: z.number().min(1).max(50).default(10).describe("Maximum number of results to return"),
}, { readOnlyHint: true, openWorldHint: false }, async ({ query, limit }) => {
    try {
        const result = await apiGet("/search", { mode: "hybrid", q: query, limit: String(limit) });
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
                    type: "text",
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
    }
    catch (err) {
        return mapApiError(err, "Try a different keyword or use search_esg for BM25-only search.");
    }
});
// ── Tool: get_term ──────────────────────────────────────────────────────
server.tool("get_term", "Fetch a glossary term by ID, slug, or permalink. Returns the full term definition and facets. Use when users ask about specific ESG terminology.", {
    term_id: z
        .string()
        .min(1)
        .describe("Term identifier — can be a slug (e.g., 'materiality'), a permalink path, or a SurrealDB record ID (e.g., 'term:abc123')"),
}, { readOnlyHint: true, openWorldHint: false, idempotentHint: true }, async ({ term_id }) => {
    try {
        const termResult = await apiGet(`/terms/${encodeURIComponent(term_id)}`);
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
            content: [{ type: "text", text }],
            structuredContent: { term },
        };
    }
    catch (err) {
        return mapApiError(err, "Check the term identifier with search_esg or list_esg_pages — slugs look like 'materiality' or 'scope-1-emissions'.");
    }
});
// ── Tool: get_related ────────────────────────────────────────────────────
server.tool("get_related", "Traverse the ESG Hub knowledge graph. Given a page or term record ID, returns all connected records grouped by edge type (related_pages, backlinks, framework, term, etc.). Use to explore how concepts interconnect.", {
    record_id: z
        .string()
        .min(1)
        .describe("Record identifier — a SurrealDB record ID (e.g., 'page:abc123') or permalink/slug"),
    edge_type: z
        .string()
        .optional()
        .describe("Optional filter: only return edges of this type (e.g., 'framework', 'term', 'related_pages')"),
}, { readOnlyHint: true, openWorldHint: false }, async ({ record_id, edge_type }) => {
    try {
        const result = await apiGet(`/pages/${encodeURIComponent(record_id)}/related`);
        let edges = result.data;
        if (edge_type) {
            edges = edges.filter((e) => e.edge_type === edge_type);
        }
        const groups = {};
        for (const edge of edges) {
            const type = edge.edge_type || "related_pages";
            (groups[type] ??= []).push(edge);
        }
        const groupText = Object.entries(groups)
            .map(([type, items]) => {
            const lines = items.map((e) => `  - **${e.title}** (${e.section || "N/A"})${e.permalink ? ` → ${BASE_URL}${e.permalink}` : ""}${e.description ? `\n    ${e.description.slice(0, 120)}` : ""}`);
            return `### ${type} (${items.length})\n${lines.join("\n")}`;
        })
            .join("\n\n");
        return {
            content: [
                {
                    type: "text",
                    text: edges.length === 0
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
    }
    catch (err) {
        return mapApiError(err, "Ensure the record_id is a valid page record ID or permalink.");
    }
});
// ── Tool: list_frameworks ────────────────────────────────────────────────
server.tool("list_frameworks", "List all ESG reporting frameworks and standards available in the knowledge base (GRI, SASB, TCFD, ESRS, etc.). Use to discover which frameworks are covered before deep-diving into a specific one.", {
    limit: z.number().min(1).max(100).default(20).describe("Number of results per page (use with offset for paging)"),
    offset: z.number().min(0).default(0).describe("Pagination offset — pass the previous response's next_offset to get the next page"),
}, { readOnlyHint: true, openWorldHint: false }, async ({ limit, offset }) => {
    try {
        const result = await apiGet("/frameworks", { limit: String(limit), offset: String(offset) });
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
            content: [
                {
                    type: "text",
                    text: `${summary}\n\n${formatted}`,
                },
            ],
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
    }
    catch (err) {
        return mapApiError(err, "The frameworks endpoint should always be available — retry in a few seconds.");
    }
});
// ── Tool: list_industries ───────────────────────────────────────────────
server.tool("list_industries", "List the ESG Hub industry taxonomy (IFRS/SASB-style), grouped by sector. Use to discover valid industry values for tagging and filtering.", {}, { readOnlyHint: true, openWorldHint: false, idempotentHint: true }, async () => {
    try {
        const result = await apiGet("/industries", { limit: "200" });
        const industries = result.items ?? [];
        const sectors = [...new Set(industries.map((i) => i.sector_id))];
        const text = [
            "# ESG Hub Industry Taxonomy",
            `\n${industries.length} industries across ${sectors.length} sectors:\n`,
            ...industries.map((ind) => `- **${ind.name_en}** (${ind.sector_id})`),
        ].join("\n");
        return {
            content: [{ type: "text", text }],
            structuredContent: { count: industries.length, industries },
        };
    }
    catch (err) {
        return mapApiError(err, "The industries endpoint should always be available — retry in a few seconds.");
    }
});
// ── Tool: propose_term ──────────────────────────────────────────────────
server.tool("propose_term", "Submit a new glossary term proposal to the ESG Hub. The proposal is reviewed before being published. Requires a valid write token in ESG_HUB_WRITE_TOKEN.", {
    name: z.string().min(1).max(200).describe("The glossary term name (e.g., 'Materiality Assessment')"),
    definition: z.string().min(10).max(5000).describe("Full definition of the term (min 10 characters)"),
    facets: z
        .object({
        topic: z.string().optional().describe("Topic area"),
        industry: z.array(z.string()).optional().describe("Relevant industries"),
        framework: z.array(z.string()).optional().describe("Related frameworks/standards"),
        jurisdiction: z.array(z.string()).optional().describe("Relevant jurisdictions"),
        stakeholder: z.array(z.string()).optional().describe("Affected stakeholder groups"),
        content_type: z.string().optional().describe("Content classification"),
    })
        .optional()
        .describe("Optional metadata facets for the term"),
}, { readOnlyHint: false, destructiveHint: false }, async ({ name, definition, facets }) => {
    try {
        const body = { name, definition };
        if (facets)
            body.facets = facets;
        const result = await apiPost("/terms", body);
        return {
            content: [
                {
                    type: "text",
                    text: `Term proposal submitted: **${name}**\n\nProposal ID: ${result.proposal_id}\nStatus: ${result.status}\n\nYour proposal will be reviewed before publication.`,
                },
            ],
            structuredContent: {
                proposal_id: result.proposal_id,
                status: result.status,
            },
        };
    }
    catch (err) {
        return mapWriteError(err, "Ensure name and definition are provided and the term doesn't already exist.");
    }
});
// ── Tool: tag_content ────────────────────────────────────────────────────
server.tool("tag_content", "Update the facet tags on an existing ESG Hub page. Facets are used for filtering, discoverability, and graph navigation. Requires a valid write token in ESG_HUB_WRITE_TOKEN.", {
    page_id: z
        .string()
        .min(1)
        .describe("Page identifier — permalink path, slug, or SurrealDB record ID (e.g., 'page:abc123')"),
    facets: z
        .object({
        topic: z.array(z.string()).optional().describe("Topic classifications"),
        industry: z.array(z.string()).optional().describe("Relevant industry sectors"),
        framework: z.array(z.string()).optional().describe("Related ESG frameworks/standards"),
        jurisdiction: z.array(z.string()).optional().describe("Applicable jurisdictions"),
        stakeholder: z.array(z.string()).optional().describe("Stakeholder groups affected"),
        content_type: z.string().optional().describe("Content type (e.g., 'guide', 'analysis', 'reference')"),
    })
        .describe("Facet tags to apply to the page"),
}, { readOnlyHint: false, destructiveHint: false }, async ({ page_id, facets }) => {
    try {
        // Resolve a permalink/slug to the SurrealDB record ID the facets route requires.
        let recordId = page_id;
        if (!recordId.startsWith("page:")) {
            const page = await apiGet(`/pages/${encodeURIComponent(page_id)}`);
            recordId = page.data.id;
        }
        const result = await apiPatch(`/pages/${encodeURIComponent(recordId)}/facets`, { facets });
        const page = result.data;
        return {
            content: [
                {
                    type: "text",
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
    }
    catch (err) {
        return mapWriteError(err, "Verify the page_id exists and the facets object is valid.");
    }
});
// ── Resources ───────────────────────────────────────────────────────────
server.resource("esg-hub-api-docs", "esg-hub://api-docs", {
    description: "ESG Hub REST API documentation with endpoints, parameters, and examples",
    mimeType: "text/markdown",
}, async () => ({
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
List pages with filtering and pagination.
- \`section\`: Filter by section
- \`pillar\`: Filter by pillar
- \`q\`: Search within titles
- \`limit\`: Results per page (max 100)
- \`offset\`: Pagination offset

### GET /api/v1/pages/:id
Get a single page by ID, permalink, or slug.
- Supports SurrealDB record IDs, permalink paths, and slugs

### GET /api/v1/resources
List external resources.
- \`domain\`: Filter by source domain
- \`q\`: Search within titles
- \`limit\`: Results per page (max 100)
- \`offset\`: Pagination offset

### GET /api/v1/search?q=query
Full-text keyword search (BM25).
- \`q\`: Search query (required)
- \`limit\`: Max results (max 50)
- \`source\`: "all" | "pages" | "external"

### POST /api/v1/search
Semantic vector search.
- Body: \`{ embedding: number[384], k?: number, source?: string }\`
- Model: BAAI/bge-small-en-v1.5 (384 dimensions)

## CORS
All endpoints support CORS for cross-origin access.
`,
        },
    ],
}));
// ── Start Server ────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ESG Hub MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
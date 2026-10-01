# ESG Hub MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI
agents access to the **ESG Hub** knowledge base — ESG articles, curated external
resources, glossary terms, reporting frameworks, the industry taxonomy, and the
knowledge graph.

- **13 tools**, read-only by default (two token-gated write tools on stdio)
- **stdio** (local) and **Streamable HTTP** (hosted) transports
- Published as [`@simonmak-ascent/esg-hub-mcp`](https://www.npmjs.com/package/@simonmak-ascent/esg-hub-mcp)

## Hosted endpoint (no install)

```
https://esg-hub.ascent.partners/api/mcp
```

opencode / Cursor / any Streamable HTTP client:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "esg-hub": { "type": "remote", "url": "https://esg-hub.ascent.partners/api/mcp" }
  }
}
```

## Local (stdio)

```jsonc
{
  "mcpServers": {
    "esg-hub": { "command": "npx", "args": ["-y", "@simonmak-ascent/esg-hub-mcp"] }
  }
}
```

From source:

```bash
cd mcp-server
npm ci && npm run build
node dist/index.js
```

## Tools

| Tool | Title | What it does | Annotations |
|------|-------|--------------|-------------|
| `get_server_info` | Get Server Info | Server version, API base, KB stats — **use this first** | read-only, idempotent |
| `search_esg` | Search ESG (keyword) | BM25 keyword search across articles + resources | read-only |
| `search_content` | Search ESG (hybrid) | Semantic + keyword fusion with ESG re-ranking | read-only |
| `get_esg_page` | Get ESG Article | Full article by permalink/slug/record ID | read-only, idempotent |
| `list_esg_pages` | List ESG Articles | Browse/filter articles, paginated | read-only |
| `list_esg_resources` | List External Resources | Curated external resources by domain, paginated | read-only |
| `get_esg_metadata` | Get Knowledge Base Stats | Sections, pillars, source domains, counts | read-only, idempotent |
| `get_term` | Get Glossary Term | Term definition + facets | read-only, idempotent |
| `get_related` | Get Related Content | Knowledge-graph neighbours of a page | read-only |
| `list_frameworks` | List Reporting Frameworks | GRI, SASB, TCFD, ESRS, CDP, … | read-only |
| `list_industries` | List Industries | IFRS/SASB-style industry taxonomy | read-only, idempotent |
| `propose_term` | Propose Glossary Term | Submit a term proposal (human-gated) | write, needs token |
| `tag_content` | Tag Content Facets | Update a page's facet tags | write, needs token |

Every tool returns a human-readable `content` block and a machine-readable
`structuredContent` payload validated against its declared `outputSchema`.
Failures return `isError: true` with a structured envelope
(`{ error: { code, message, retryable, hint } }`).

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `ESG_HUB_API_BASE` | `https://esg-hub.ascent.partners` | REST API base |
| `ESG_HUB_API_URL` | `https://esg-hub.ascent.partners` | Base used for display links |
| `ESG_HUB_WRITE_TOKEN` | — | Required for `propose_term` / `tag_content` |

## Development

```bash
npm ci
npm run build
node scripts/smoke.mjs https://esg-hub.ascent.partners   # contract smoke test
```

## License

MIT — content from the ESG Hub is licensed CC BY-SA 4.0 by Ascent Partners Foundation.

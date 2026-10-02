# ESG Hub — Open-Access ESG Encyclopedia

[![Deploy to Vercel](https://github.com/simonplmak-cloud/esg-hub/actions/workflows/deploy.yml/badge.svg)](https://github.com/simonplmak-cloud/esg-hub/actions/workflows/deploy.yml)
[![License: MIT (code)](https://img.shields.io/badge/code-MIT-green.svg)](LICENSE)
[![Content: CC BY-SA 4.0](https://img.shields.io/badge/content-CC%20BY--SA%204.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

**[esg-hub.ascent.partners](https://esg-hub.ascent.partners)** — a free, open-access encyclopedia of Environmental, Social, and Governance (ESG) knowledge by [Ascent Partners Foundation](https://www.ascent.partners): 350+ articles, 240+ curated external resources, books, courses, and a video library — available in English, Chinese, and Hindi.

## Features

- **Knowledge base** — 350+ ESG articles across standards (GRI, IFRS S1/S2, TCFD, TNFD, ESRS), regulations, frameworks, ratings, and regional (HK/APAC) guidance
- **AI search** — ask questions in natural language; answers grounded in the knowledge base (SurrealDB BM25 + vector search, DeepSeek, Brave Search across authoritative ESG domains)
- **Public REST API** — open access to all content: [`/api/v1`](https://esg-hub.ascent.partners/api/v1)
- **MCP server** — connect AI agents directly: [`@esg-hub/mcp-server`](mcp-server/)
- **Learning resources** — free courses, books, and a curated video library
- **i18n** — English, Chinese, Hindi

## Tech stack

Next.js 15 (App Router, React 19) · SurrealDB Cloud · Tailwind CSS v4 · next-intl · Vitest + Playwright · Vercel

## Quick start

```bash
git clone https://github.com/simonplmak-cloud/esg-hub.git
cd esg-hub
pnpm install        # note: requires sibling repo ../tool_package (private)
cp .env.example .env  # fill in your own values
pnpm dev
```

Useful commands: `pnpm lint` · `npx tsc --noEmit` · `npx vitest run` · `pnpm verify:db`

> **Note:** the app renders content from a SurrealDB database — you need your own instance and content to run a full copy. The public site and API are freely accessible without running anything.

## API & MCP

- **REST API:** open, no auth — `GET /api/v1/pages`, `/api/v1/search?q=...`, `/api/v1/resources`, `/api/v1/meta` ([docs](https://esg-hub.ascent.partners/en/developers/api))
- **MCP server:** see [`mcp-server/`](mcp-server/) — gives AI agents tools to search and read the knowledge base

## Contributing

- **Content errors** (wrong/outdated info, dead links): open a [content error issue](https://github.com/simonplmak-cloud/esg-hub/issues/new/choose)
- **Bugs and code changes**: see [CONTRIBUTING.md](CONTRIBUTING.md)
- **Security vulnerabilities**: report privately via [SECURITY.md](SECURITY.md)

## Use with Context7

Up-to-date ESG Hub documentation is indexed on [Context7](https://context7.com/simonplmak-cloud/esg-hub), so coding agents can pull it into context on demand. With the Context7 MCP server or `ctx7` CLI installed, name the library in your prompt:

```text
use library /simonplmak-cloud/esg-hub for API and docs
```

## License

- **Code:** [MIT](LICENSE)
- **Encyclopedia content:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) by Ascent Partners Foundation

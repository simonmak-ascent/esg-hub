# Changelog

## 1.4.0

- Rewrote every tool description to maximize TDQS: explicit when / when-not with
  a named alternative, pagination (`next_offset`) and ordering behaviour, result
  caps, empty-result and NOT_FOUND behaviour, write side effects + auth/rate-limit
  notes, and parameter semantics beyond the schema.
- Narrowed `get_server_info` to server-only metadata (`name`, `version`,
  `api_base`, `tool_count`, `healthy`); knowledge-base stats now live only on
  `get_esg_metadata` (removes the overlap).
- Added `flag_content` (14th tool) with `POST /api/v1/pages/:id/flag` — queues a
  page for human curation (delist / remove / review).
- Added `list_terms` (15th tool) over the existing `GET /api/v1/terms` — survey
  the glossary with name-substring filtering and pagination.

## 1.3.2

- Release re-cut: npm had staged 1.3.1 (publish conflict) and the registry
  publish raced npm propagation. No code changes.

## 1.3.1

- Registry metadata: shorten `server.json` description to the MCP Registry's
  100-character limit. No tool or API changes.

## 1.3.0

- **Tool contracts reconciled with the live REST API.** `search_content` reads
  the hybrid `results`/`relevance` shape; `list_frameworks` reads `items`;
  `get_term` uses the new `GET /api/v1/terms/:id`; `propose_term` reads the
  top-level `{proposal_id,status}`; `tag_content` resolves permalinks to record
  IDs and accepts `topic` as an array; `list_industries` is DB-backed via
  `GET /api/v1/industries`.
- **TDQS-grade surface.** All tools migrated to `registerTool` with `title`,
  `outputSchema`, and annotations; descriptions rewritten for tool selection.
- Added `get_server_info` primer tool (13 tools total).
- API base now defaults to the production URL (was `localhost:3000`).
- Added `mcp-server/scripts/smoke.mjs` stdio contract smoke test.

## 1.2.0

- Added `search_content` (hybrid), `get_term`, `get_related`, `list_frameworks`,
  `list_industries`, `propose_term`, `tag_content`.

## 1.1.0

- Tool annotations, pagination metadata, structured error envelopes.

## 1.0.0

- Initial release: `search_esg`, `get_esg_page`, `list_esg_pages`,
  `list_esg_resources`, `get_esg_metadata`.

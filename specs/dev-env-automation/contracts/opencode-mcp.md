# Contract: opencode.json MCP Changes

File: `~/.config/opencode/opencode.json` (outside repo; changes backed up to `opencode.json.bak-<date>` first). Verified by live MCP calls after edit + session restart.

## Diff (conceptual)

| Server | Before | After |
|--------|--------|-------|
| `github` | `GITHUB_PERSONAL_ACCESS_TOKEN: "{env:GH_TOKEN}"` (humanity4ai) | `"{env:SIMONMAK_ASCENT_PAT}"` |
| `brave-search` | `"enabled": false` (BRAVE_API_KEY set) | `"enabled": true` |
| `google-search` | `"enabled": false` (GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID set) | `"enabled": true` |
| `browserless` | `"enabled": false`, service down | `"enabled": true` **after** service verified (`curl localhost:3000` → 200); if unrepairable, stays disabled with verdict logged (R7) |
| `vercel` | absent | `{ "type": "remote", "url": "https://mcp.vercel.com", "enabled": true }` |

## Vercel MCP auth note

`https://mcp.vercel.com` is OAuth-only — no static token header (verified against Vercel docs). First use triggers opencode's OAuth consent flow. If OAuth cannot complete in this environment (R4): set `"enabled": false` and record the CLI/API alternative (`curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/...`) in `log-review.md` — satisfies AC-15's documented-alternative clause.

## Unchanged (verified working in baseline)

`context7`, `playwright`, `perplexity`, `esg-hub`, `gh_grep`, `postgres`, `n8n`, `humanity4ai`, `clerk` — each gets one live verification call during implementation (spec AC-14 scope: perplexity/brave/google/browserless; the rest are smoke-checked only if touched).

## Out of scope (remain disabled)

`google-workspace`, `ms-365` — pending OAuth per global config notes.

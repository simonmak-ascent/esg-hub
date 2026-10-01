# AGENTS.md - ESG Hub

## Commands

```bash
pnpm dev              # Next.js dev server (port 3000)
pnpm build            # Production build (standalone output; needs SURREAL_* env)
pnpm lint             # ESLint flat config; unused vars starting with _ are ignored
npx tsc --noEmit      # Type check (strict; excludes mcp-server/)
npx vitest run        # Unit tests (43 across hybrid, rate-limit, write-token)
pnpm test             # Playwright E2E
pnpm verify:db        # Verify SurrealDB schema including KM tables
pnpm eval-search      # 30-query search benchmark (nDCG@10 ≥ 0.6)
pnpm eval-pipeline    # Pipeline calibration check (ECE + field-level F1)
```

KM-specific scripts (all need SURREAL_* env; use `opencode_admin` from `~/.env.opencode`, not `root` — root is Viewer-only):
```bash
node scripts/setup-km-schema.mjs      # Idempotent: 7 tables, 5 RELATION types, 15 indexes, 2 events, 4 functions
node scripts/seed-km-vocab.mjs        # Controlled vocabularies (6 facets, 59 values)
node scripts/seed-km-sources.mjs      # Backfill source table from external_resource domains
node scripts/backfill-standards.mjs    # 33 standards pages → framework records + defines edges
node scripts/migrate-crossrefs-to-edges.mjs  # 1,663 array links → RELATION edges
node scripts/review-enhancements.mjs    # Human gate: --list, --show, --approve, --reject
node scripts/release-km-lock.mjs       # Break-glass lock recovery
```

CI gate order (`.github/workflows/deploy.yml` check job): lint → tsc → vitest → verify:db (continue-on-error) → build. `ci.yml` runs the same gates on every PR/push. Run all four before pushing; Playwright runs only in CI against deployed URLs.

### Local install prerequisite

`package.json` has `file:../tool_package/packages/{utils,validation}` deps — `pnpm install` fails unless the sibling repo `simonplmak-cloud/tool_packages` exists at `../tool_package` (repo name plural, local path singular). CI checks it out and symlinks it.

### Playwright ports

Local: the config starts its own `next dev -p 3001` webServer (`playwright.config.ts:31`) — E2E never uses the port-3000 dev server. CI: no webServer; tests hit `BASE_URL` (the Vercel deployment). Preview deploys must have Vercel Deployment Protection disabled or E2E fails (see `VERCEL_PROTECTION_FIX.md`).

## Architecture

- Next.js 15 App Router, React 19, `output: "standalone"` (`next.config.mjs:7`). Production deploys are **prebuilt-in-CI**: the deploy job runs `vercel build --prod` + `vercel deploy --prebuilt --prod` in GitHub Actions (the `file:../tool_package` deps don't exist on Vercel's builders, so Vercel-side builds fail). Vercel's git-integration builds are disabled via `commandForIgnoringBuildStep: "exit 0"` — do not re-enable them.
- Whole site is request-time DB rendering: `export const dynamic = "force-dynamic"` in `src/app/[locale]/layout.tsx:11`.
- `src/app/layout.tsx` is a pass-through; the real layout is `src/app/[locale]/layout.tsx`. Root `src/app/page.tsx` only redirects to `/en`.
- `next-intl` prefixes all routes with `/en`, `/zh`, `/hi` (`src/i18n/routing.ts`). Unprefixed paths 307-redirect to the default locale via middleware.
- Database: SurrealDB Cloud via JSON-RPC over HTTP (`queryHttp()` / `queryHttpAll()` in `src/lib/surrealdb.ts`) — never WebSocket.
- DB namespace is hardcoded to `"esg_hub"` in app code (`surrealdb.ts:20`) AND in `scripts/lib/db-env.mjs` — the `SURREAL_NAMESPACE` env var is intentionally ignored everywhere so another project's shell var (e.g. `valuation`) can't shadow it. Scripts override only via `ESG_HUB_NS_OVERRIDE`.
- `src/pages/_error.js` is the last Pages Router file — never add pages there.
- Node: `.nvmrc` says 22.x, CI uses 20, engines allow >=18 <24.

### mcp-server/ (separate package)

Standalone MCP server (`@esg-hub/mcp-server`) wrapping the public REST API at `/api/v1`. Not in the pnpm workspace, excluded from root tsconfig and vitest, installed with npm. Its `dist/` and `package-lock.json` are committed to git for reproducibility. v1.2.0: 12 tools (5 original + 7 new) with read/write annotations, structured error envelopes, and pagination. Write tools (`propose_term`, `tag_content`) use a server-owned Bearer token from `ESG_HUB_WRITE_TOKEN` env var — they call the REST write endpoints, not SurrealDB directly. After editing `src/index.ts`, rebuild with `npx tsc` in `mcp-server/` and commit `dist/`.

### specs/ and constitution.md

`specs/` holds spec-driven-development artifacts (spec/plan/tasks per feature; e.g. `dev-env-automation`, `ux-mcp-content-bestpractice`). `constitution.md` formally restates this file's constraints for SDD workflows. For DB content work, the repeatable procedure lives in `specs/ux-mcp-content-bestpractice/content-review-methodology.md` (claim verification → References format → accuracy log).

### Workflows (all in `.github/workflows/`)

- `ci.yml` — lint/tsc/vitest gates on push and PRs (concurrency-cancelling)
- `deploy.yml` — push to main: check job then prebuilt deploy to production, E2E against the live URL
- `deploy-preview.yml` — PR: prebuilt preview deploy + E2E, comments the preview URL
- `test.yml` — `workflow_dispatch` on-demand test runner (inputs: `base_url`, `skip_e2e`)
- `nightly.yml` — 18:17 UTC health check with `nightly-alert` issue lifecycle
- `km-ingestion.yml` — cron 06:17+18:17 UTC; LLM pipeline enqueing 46+ sources, extracting terms, human-gated
- `km-rd-loop.yml` — cron 04:13 UTC daily; link freshness, claim verification, cross-ref validation
- `pr-title.yml` — PR titles must match conventional commits (`feat|fix|ci|chore|docs|refactor|test|perf(scope): …`) or the check fails
- `opencode.yml` / `opencode-auto.yml` — OpenCode agent triggers via `/oc` comments

### Repo status: public + protected

Repo is **public** (since 2026-07-20). `main` has classic branch protection (required status check `check`, force-push blocked, `enforce_admins: false` — admin direct pushes still work). Ruleset `main-protection` adds `non_fast_forward` + `copilot_code_review` (Copilot auto-reviews every PR). Dependabot is enabled for the `github-actions` ecosystem only (the `npm` ecosystem was removed — Dependabot's sandbox can't resolve `file:../tool_package` deps); Dependabot-triggered runs get secrets from the **Dependabot secrets store** (repo secrets are withheld from Dependabot runs). Community files exist and must stay accurate: `LICENSE` (MIT code), `LICENSE-CONTENT.md` (CC BY-SA 4.0 content), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CITATION.cff`, `.github/ISSUE_TEMPLATE/`.

## Environment Variables

Secrets are shell-level (`~/.bashrc`), never in repo files. **Never read `.env*` files.** `.env.example` exists for contributor setup (names only). Admin credentials for SurrealDB schema migrations are in `~/.env.opencode` (`opencode_admin` with Editor/Owner role) — the `root` user in `~/.bashrc` has Viewer-only IAM and cannot modify schema.

| Variable | Notes |
|----------|-------|
| `SURREAL_URL` / `SURREAL_USERNAME` / `SURREAL_PASSWORD` / `SURREAL_DATABASE` | SurrealDB Cloud; required for dev, build, `verify:db`. Use `opencode_admin` credentials from `~/.env.opencode` for schema mutations; `root` (Viewer) for read-only app queries. |
| `SURREAL_NAMESPACE` | Ignored by app code AND by `scripts/*.mjs` (both hardcode `esg_hub`; scripts override via `ESG_HUB_NS_OVERRIDE` only) |
| `DEEPSEEK_API_KEY` | AI search/chat API routes + KM ingestion pipeline LLM calls |
| `BRAVE_API_KEY` | Web search for the AI search feature (`src/app/api/ai-search/route.ts`) |
| `PERPLEXITY_API_KEY` | Claim verification in the KM R&D loop (`km-rd-loop.yml`) |
| `ESG_HUB_WRITE_TOKEN` | Bearer token for MCP write tools + pipeline REST API calls to `POST /api/v1/terms` and `PATCH /api/v1/pages/:id/facets` |
| `SIMONPLMAK_CLOUD_PAT` | GitHub PAT for the `simonplmak-cloud` account (owns this repo); `GH_TOKEN` aliases it |
| `VERCEL_TOKEN` | Vercel API token for deployment/log inspection |

### GitHub identity

This repo belongs to the `simonplmak-cloud` account. gh CLI and git authenticate as `simonplmak-cloud` (PAT in `SIMONPLMAK_CLOUD_PAT`/`GH_TOKEN`; git via repo-local `credential.username` + `~/.git-credentials`). The `humanity4ai` account is secondary — if a command 404s on `simonplmak-cloud/*`, check which token is in use.

## Conventions

- TypeScript strict; path alias `@/*` → `./src/*`; `type` for unions/primitives, `interface` for objects.
- Server Components by default; `"use client"` only for hooks, event handlers, or browser APIs.
- SurrealQL: always pass user input through `sanitize()` / `sanitizeInt()` / `isAlphanumericDash()` (all in `src/lib/surrealdb.ts`) before interpolating. Raw interpolation is a banned pattern.
- API routes: `export const runtime = "nodejs"`, an `OPTIONS` handler returning 204 with CORS headers, and `{ error: "Internal error" }` with status 500 on failure. Pattern: `src/app/api/v1/route.ts`. Write routes (`POST /api/v1/terms`, `PATCH /api/v1/pages/:id/facets`) additionally require `Authorization: Bearer <ESG_HUB_WRITE_TOKEN>` and in-memory rate limiting.
- Styling: Tailwind CSS v4 via `@import "tailwindcss"` in `globals.css` (no tailwind.config); design tokens are CSS vars there (`--color-primary`, `--font-body`, ...).
- Vitest: `@/*` alias resolved via `vitest.config.ts` (added for KM tests). ESLint: `_` prefix suppresses unused-var warnings via `argsIgnorePattern`/`varsIgnorePattern`/`caughtErrorsIgnorePattern` in `eslint.config.mjs`.

## KM Architecture (Phase 1)

- **Data model** (`scripts/setup-km-schema.mjs`): 7 new tables (`term`, `framework`, `industry`, `entity`, `source`, `scrape_job`, `content_enhancement_log`) + 5 RELATION types (`related_to`, `defines`, `cites`, `regulates`, `applies_to`) on the existing SurrealDB 3.2 instance. `DEFINE FIELD IF NOT EXISTS last_verified ON page` adds a rotation-scheduling column. All additive — zero existing-schema changes.
- **Hybrid search** (`src/lib/search/hybrid.ts`): `GET /api/v1/search?mode=hybrid` — Stage 1 BM25+HNSW via `search::rrf(k=60)`, Stage 2 percentile-ranked ESG re-rank (0.40/0.20/0.15/0.15/0.10 weights). Benchmarked via `pnpm eval-search` (nDCG@10 ≥ 0.6).
- **Pipeline** (`scripts/km-ingestion.mjs`): GH Actions cron (06:17+18:17 UTC). 4-layer LLM: extract(cheap)→normalize(rules+source_span verification)→verify(strong, low-confidence only)→propose(human-gated). Uses `fastembed-js` for server-side embedding (same BGE-small 384d as browser). `scripts/lib/pipeline-*.mjs` provide shared fetch/normalize/llm/embed modules.
- **R&D loop** (`scripts/km-rd-loop.mjs`): GH Actions cron (04:13 UTC daily). Rotates through 354 pages: link freshness (HEAD→GET fallback), claim re-check via Perplexity API, cross-ref consistency. Writes proposals to review queue.
- **MCP v1.2.0**: `search_content`, `get_term`, `get_related`, `list_frameworks`, `list_industries` (read) + `propose_term`, `tag_content` (write, token-gated).
- **Skills**: `.opencode/skills/esg-{taxonomy-tagging,relevance-ranking,glossary-writer,source-authority-review}/`
- **Locking**: GH Actions `concurrency` group + SurrealDB lease with fencing token. `scripts/release-km-lock.mjs` for break-glass recovery.
- **Dependencies**: `cheerio`, `@huggingface/fastembed` added for pipeline. Install with `pnpm add cheerio @huggingface/fastembed`.

## Testing

- **This machine is too slow for local E2E** — Playwright times out. Run tests on GitHub instead: `gh workflow run test.yml` (inputs: `base_url`, `skip_e2e`), then `gh run watch`. Local `pnpm test` is unsupported here.
- **Nightly health check** (`nightly.yml`, 18:17 UTC cron): verify:db + prod smoke are hard gates; lychee link sweep is informational. Issue lifecycle on the `nightly-alert` label: opens/comments with typed details on failure (HARD = named check, LINKS = failing URLs), auto-closes on a fully clean run, silent when green with no open issue.
- Unit: Vitest in `src/lib/__tests__/`; `vitest.config.ts` excludes `e2e/`, `node_modules/`, `mcp-server/`.
- E2E: Playwright in `e2e/` (currently only `locale-routing.spec.ts`), Chromium only.
- CI runs E2E twice per change: against the PR preview deployment and against production after merge.
- Search eval: `pnpm eval-search` runs 30 labeled queries, asserts nDCG@10 ≥ 0.6. Non-blocking in CI.
- Pipeline eval: `pnpm eval-pipeline` runs pipeline calibration check (ECE + field-level F1). Nightly only.

## i18n

- Locales `en` (default), `zh`, `hi`; translations in `messages/*.json`; server `getTranslations`, client `useTranslations`.
- DB-level translations live on page records: `title_zh/hi`, `description_zh/hi`, `content_zh/hi`.

## Middleware

`src/middleware.ts`: hosts matching `*.esg.video` get a 308 redirect to `https://esg-hub.ascent.partners/videos` unless the path already starts with `/videos` (vercel.json duplicates this at the edge). Everything else passes to the next-intl locale-prefix middleware.

## Scripts

`scripts/*.mjs` are one-off/manual DB migration and content-maintenance scripts (run with `node`, need `SURREAL_*` env). Only `verify-db-schema.mjs` is wired to a pnpm script. Do not run mutation scripts unless asked.

Content-work drivers (all dry-run-first; use them rather than ad-hoc SQL):
- `scripts/review-pilot-content.mjs` — `--fetch <permalink>` (backup+dump), `--apply <permalink> --file <path> [--write]`; validates every URL live before writing (bot-blocks 403/415/429/202 accepted, others fail) and requires a `## References` section. `--status` shows section coverage.
- `scripts/generate-cross-references-pilot.mjs` — `--section <name> [--apply]`; writes `related_pages`/`backlinks` as **record IDs** (not permalinks — the `/api/v1/pages/:id/related` and `/backlinks` routes expect IDs). Dry-run reviews assignments before `--apply`.

## Git

- No commits unless explicitly requested; never force-push main.
---

<!-- opencode-supervisor -->
## OpenCode Supervisor Mode

When running in GitHub Actions (via the `opencode` / `opencode-auto`
workflows), OpenCode acts as the **engineering supervisor**, not an
implementer. The GitHub Copilot coding agent (`@copilot`) writes the code.

Core rules (full playbook: load the `copilot-supervisor` skill):

- Triage and clarify issues; dispatch well-scoped coding tasks to `@copilot`
  via GraphQL assignment (REST `--add-assignee copilot` silently fails —
  see the `copilot-supervisor` skill for exact commands).
- Review PRs authored by `copilot-swe-agent[bot]`; send numbered change
  requests to `@copilot` instead of pushing fixes; approve when ready.
- Never merge PRs — the human merges.
- Use the `context7` and `gh_grep` MCP servers to ground guidance in docs
  and real-world code patterns.
<!-- /opencode-supervisor -->

## Agent Skills

This project includes 4 ESG-specific agent skills under `.opencode/skills/`:

- `esg-taxonomy-tagging` — Classify ESG content across perspective facets
- `esg-relevance-ranking` — Apply ESG re-rank weights to search results
- `esg-glossary-writer` — Draft structured term definitions with citations
- `esg-source-authority-review` — Score source credibility across 5 dimensions

Load a skill with: skill(name="esg-taxonomy-tagging")

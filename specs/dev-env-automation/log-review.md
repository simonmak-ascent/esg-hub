# Log Review — Development Environment Automation

Baseline sweep: 2026-07-19 · Reviewer: opencode (with user-provided tokens)
Purpose: record of environment state before/after each change per spec `spec.md` (AC-A12).

## Legend

- 🔴 broken/failing · 🟡 warning/misaligned · 🟢 verified clean · ⚪ not yet examined

## Baseline (2026-07-19)

### GitHub Actions

| Item | State | Evidence |
|------|-------|----------|
| `Deploy to Vercel` — last 6 runs (2026-07-19) | 🔴 all failed | Runs 29677821061 (2m32s), 29677495493 (36s), 29676967406 (41s), 29676767997 (9s), 29675677866 (27s), 29674763034 (7s). Latest: `check` job ✅, `deploy` job failed at "Wait for deployment to be ready" |
| Last green run | 2026-03-01 (run 22539797324, 7m27s) | `gh run list` |
| `Deploy Preview to Vercel` | ⚪ no recent runs (no PRs) | — |
| Branch protection on `main` | 🔴 none | protection API 404 "Branch not protected" |
| Secrets inventory | 🟢 9/9 present | SURREAL_URL, SURREAL_USERNAME, SURREAL_PASSWORD, SURREAL_NAMESPACE, SURREAL_DATABASE, TOOL_PACKAGES_PAT, VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN |
| Dependabot alerts / auto-fixes | 🔴 alerts 404 (disabled); auto-fixes `{"enabled":false}` | API |
| Security analysis (secret scanning/CodeQL) | 🔴 not configured; `security_and_analysis` empty | API |
| gh CLI / git auth | 🔴 authenticated as `humanity4ai` → repo 404s | `gh auth status`; `git ls-remote` "Repository not found" |

### Vercel (project `esg-hub`, team_WdRBvuyKYcVGwtSk1T9dIoaY)

| Item | State | Evidence |
|------|-------|----------|
| Last 6 production deployments | 🔴 ERROR | errorCode `ENOENT`, errorMessage `Command "pnpm install" exited with 254`, errorStep `buildStep` (e.g. dpl_9YAHCXVk5q4PDNtdXasWJf4T3rxr) |
| 1 deployment | 🟡 BLOCKED | esg-hq9ojwib8 (2026-07-19) |
| Last READY production | 2026-03-01 | esg-20wzoostj / esg-4q2nez2r2 / esg-rqpyrz8th |
| Root cause | `pnpm-lock.yaml` added in c9bffd4 → Vercel uses pnpm → `file:../tool_package` missing on builder → install ENOENT. npm (used at dc21ae1, package-lock.json present) tolerated it | lockfile history |
| `nodeVersion` | 🟡 24.x — violates `engines: >=18 <24` | project API |
| `ssoProtection` | 🟡 `all_except_custom_domains` — preview E2E would hit SSO | project API |
| `passwordProtection` / `trustedIps` | 🟢 none | project API |
| installCommand/buildCommand/output/rootDir/packageManager | all default (null) | project API |
| Prod alias `esg-hub.ascent.partners` | 🟢 200 | curl |
| Old domain `esg-hub-six.vercel.app` | 🔴 404 (dead) | curl root + /api/v1 |

### SurrealDB Cloud

| Item | State | Evidence |
|------|-------|----------|
| Health (namespace `esg_hub`) | 🟢 354 pages, 29 sections, no dup permalinks, no missing required fields, indexes on section/slug/related_pages/backlinks exist | `SURREAL_NAMESPACE=esg_hub node scripts/verify-db-schema.mjs` |
| UNIQUE index on `page.permalink` | 🟡 missing — duplicates possible | verify:db recommendations |
| Shell `SURREAL_NAMESPACE` | 🔴 `valuation` (foreign project) — scripts read env → target wrong DB; verify reported "0 pages" until overridden | direct run |
| `verify-db-schema.mjs:13` | 🔴 hardcoded password fallback committed | file read |

### Local machine / repo

| Item | State | Evidence |
|------|-------|----------|
| `../tool_package` sibling (file: deps) | 🟢 present (`packages/utils`, `packages/validation`) | ls |
| Dead-domain references | 🔴 4 files: `src/app/robots.ts:12`, `src/app/videos/page.tsx:13,18`, `src/lib/constants.ts:7`, `mcp-server/README.md` | grep |
| Prod API smoke `esg-hub.ascent.partners/api/v1` | 🟢 200 | curl |
| Local E2E | 🟡 unsupported — machine too slow, Playwright times out | user statement |
| `.vercel/project.json` | 🟢 linked (prj_7iHf6JTFeLxJXpTrx08Oiv8u6Wy0) | file read |

### MCP servers (`~/.config/opencode/opencode.json`)

| Server | State | Note |
|--------|-------|------|
| context7 | 🟢 enabled | |
| github | 🔴 enabled but token = `humanity4ai` (GH_TOKEN) → no esg-hub access | rewire to `SIMONPLMAK_CLOUD_PAT` |
| playwright | 🟢 enabled | |
| perplexity | 🟢 enabled, verified live (search returned results 2026-07-19) | |
| esg-hub (local) | 🟢 enabled, verified live (354 pages via prod API) | code default URL correct; README wrong (F11) |
| gh_grep | 🟢 enabled | |
| postgres | 🟢 enabled (DATABASE_URL set) | not yet exercised |
| n8n | 🟢 enabled (N8N_API_KEY set) | not yet exercised |
| humanity4ai | 🟢 enabled (`/mnt/c/git_repo/project_human` exists) | not yet exercised |
| clerk | 🟢 enabled | not yet exercised |
| brave-search | 🟡 disabled; BRAVE_API_KEY set | enable per spec |
| google-search | 🟡 disabled; GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID set | enable per spec |
| browserless | 🔴 disabled; token set but service down (localhost:3000 → curl 000) | repair then enable |
| google-workspace | ⚪ disabled pending OAuth (out of scope) | |
| ms-365 | ⚪ disabled pending OAuth (out of scope) | |
| vercel | 🔴 absent | add per spec (token verified 2026-07-19) |

## Resolution Log

| Finding | Resolution | Verified by | Date |
|---------|-----------|-------------|------|
| F1/F2 deploys broken (pnpm ENOENT) | deploy.yml → prebuilt-in-CI (`vercel build --prod` + `deploy --prebuilt --prod`); PR #2 merged | run 29689232543 success; Vercel READY `esg-436ra0u6x`; live robots.txt serves new build | 2026-07-19 |
| F3 node 24.x | PATCH `nodeVersion: 22.x` | project GET read-back | 2026-07-19 |
| F4 preview SSO protection | PATCH `ssoProtection: null` | read-back + PR #2 preview E2E green unauthenticated (run 29689025247) | 2026-07-19 |
| F5 no branch protection | _pending Phase 2 (T-15 ruleset)_ | | |
| F7 wrong-account auth | PAT → `~/.bashrc` (`SIMONPLMAK_CLOUD_PAT`, `GH_TOKEN` aliased); gh hosts.yml active=simonplmak-cloud; repo-local `credential.username` | AC-A1: `gh api user` → simonplmak-cloud, repo API 200, `git ls-remote` ✓ | 2026-07-19 |
| F8 namespace shadowing | `scripts/lib/db-env.mjs` (hardcodes esg_hub; `ESG_HUB_NS_OVERRIDE` warns); 14 scripts migrated; syntax-checked | `SURREAL_NAMESPACE=valuation` → verify reports 354 pages; override → warns + targets override | 2026-07-19 |
| F9 unique permalink index | already existed (`idx_page_permalink`); removed redundant duplicate `unique_permalink`; **verify-db detection bug fixed** (INFO FOR TABLE returns SurrealQL strings, not objects) | `pnpm verify:db` zero warnings, 354 pages | 2026-07-19 |
| F10 password fallback | removed from `verify-db-schema.mjs:13` | line now `\|\| ""` | 2026-07-19 |
| F11 dead domain refs | fixed robots.ts, constants.ts, videos/page.tsx, mcp README | grep = 0 hits; live robots.txt → ascent.partners sitemap | 2026-07-19 |
| F12 MCP config | opencode.json: github→`SIMONPLMAK_CLOUD_PAT`; brave-search/google-search **globally installed** (npx cold-start broke handshake); browserless + vercel remote configured | **github ✓** (simonplmak-cloud). **browserless ✓** (screenshot). **brave-search/google-search: servers load + tools execute ✓, but API keys rejected** — BRAVE_API_KEY → 422 SUBSCRIPTION_TOKEN_INVALID; GOOGLE_API_KEY → "API key not valid" (user must refresh both keys). vercel: `needs_auth` → `opencode mcp auth vercel` | 2026-07-20 |
| F19 other MCP failures (discovered in startup logs) | n8n remote: `needs_auth` (N8N_API_KEY expired/invalid); playwright, postgres, humanity4ai: failed at session start (cold-start/env — playwright npx slowness, postgres needs local DB at localhost:5432, humanity4ai needs `/mnt/c/git_repo/project_human` running) | logged 2026-07-20; outside spec scope — user decides | 2026-07-20 |
| F13 no on-demand tests | `.github/workflows/test.yml` (workflow_dispatch) | run 29689564162: check+e2e success vs production | 2026-07-19 |
| F14 zero automation | Dependabot (github-actions), vuln alerts (204), auto security fixes (on), PR template, PR-title lint, nightly health check, dedup-issue alerts; secret scanning → plan-blocked (422) → gitleaks job in test.yml | Dependabot PRs #4–6 opened same day; nightly dispatch green (29693468529); issue #8 auto-created on failure | 2026-07-19 |
| F15 Vercel env vars missing `preview` target (all 6 keys) — preview deploys had no DB creds; E2E "Page Not Found" test failed on DB-error page | added `preview` target to the production entry of each key | env GET: all keys = [development, preview, production]; preview E2E then passed | 2026-07-19 |
| F16 Vercel git integration double-build: every push spawned a Vercel-side build (source:git) → perpetual ERROR zombies | `commandForIgnoringBuildStep: "exit 0"` (skips git-triggered builds; CI owns deploys) | deployment list now: READY(cli) + CANCELED(git) pattern, zero ERROR in last 10 | 2026-07-19 |
| F17 preview workflow Comment PR 403 (default GITHUB_TOKEN read-only) → E2E skipped | explicit `permissions:` (issues/pull-requests write) on deploy-preview.yml; least-privilege blocks on all workflows | rerun: Comment PR ✓, E2E ran | 2026-07-19 |
| F18 stale E2E: asserted English "Developers" on zh/hi pages (DB titles are translated) | aligned with sibling tests (`toBeVisible`) | preview run 29689025247 success | 2026-07-19 |

## Final re-sweep (2026-07-19, AC-A12)

| Plane | Result |
|-------|--------|
| Actions (last 10) | ✅ deploy/preview/nightly/test all green; 2 Dependabot `npm_and_yarn` update-job failures → AC-DE1 verdict: npm ecosystem removed from dependabot.yml (file: deps break its sandbox); github-actions updates continue |
| Vercel (last 10) | ✅ READY(cli)×4 production + CANCELED(git)×6 — zero ERROR; zombie builds eliminated |
| SurrealDB | ✅ verify:db zero warnings; 354 pages; unique permalink index singular (`idx_page_permalink`) |
| Prod smoke | ✅ /en, /api/v1, /robots.txt → 200; robots.txt sitemap → ascent.partners |
| GitHub settings | ✅ required check `check` + force-push blocked (classic API — ruleset rejects status checks on this plan); ruleset active: non_fast_forward + copilot_code_review; alerts/auto-fixes on; homepage fixed |
| Vercel settings | ✅ nodeVersion 22.x; ssoProtection off; env targets all 3; ignore-step set |

## Pre-publication secret sweep (2026-07-20)

| Item | State | Evidence |
|------|-------|----------|
| gitleaks full-history scan (133 commits) | 🟡 1 finding | `src/app/api/ai-search/route.ts:24` — live GCP API key committed as fallback (prod had no Vercel env var, so the fallback was in active use) |
| GCP key fallback in code | ✅ removed | `|| ""`; interim value added to Vercel env (all 3 targets) so prod keeps working until user rotates the key in GCP Console |
| `GOOGLE_CSE_ID` fallback | ✅ removed | same change; also added to Vercel env |
| SurrealDB root password rotation | ✅ rotated + verified | `DEFINE USER OVERWRITE root ON ROOT PASSWORD … ROLES OWNER`; new password queried OK (354 pages), old rejected (401). Updated: Vercel env ×2 entries, GitHub secret, `~/.bashrc` |
| Deploy with rotated creds | ✅ green | run 29711734065 success; prod /en + /api/v1 → 200 |

**Repo-public gate:** ~~BLOCKED~~ **REPO IS PUBLIC as of 2026-07-20** ✅

## Repository publication record (2026-07-20)

| Step | Result |
|------|--------|
| Pre-publication sweeps | gitleaks history scan (1 GCP key found + removed from HEAD); SurrealDB password rotated everywhere first |
| Exposed GCP API key | ✅ deleted by user in GCP Console; verified "API Key not found" (was "forbidden" before) |
| Visibility flip | `PATCH private:false` → `"visibility":"public"` |
| Secret scanning + push protection | ✅ enabled (free on public) — **AC-D4 fully satisfied natively**, gitleaks CI job now redundant-but-harmless |
| Dependabot | security updates enabled; alerts API 204; 0 open vulnerability alerts |
| Branch protection | ✅ survived: required check `check`, enforce_admins=false |
| Ruleset | ✅ survived: active, `non_fast_forward` + `copilot_code_review` |
| Footer GitHub link | ✅ 200 (was anonymous-404 — lychee false-positive eliminated) |
| Prod | /en + /api/v1 → 200 after all changes |

Exposed-credential postures after publication: SurrealDB password — rotated before exposure (history value invalid). GCP key — deleted before exposure (history value invalid). **No live credentials exist in the repo history.**

## Brave Search replacement + AI search repair (2026-07-20)

| Item | State | Evidence |
|------|-------|----------|
| Google CSE → Brave Search (site AI search) | ✅ replaced + verified live | `braveSearch()` in `ai-search/route.ts` scoped to 12 authoritative ESG domains (from the `external_resource` corpus + standard-setters) via `site:` operators; `BRAVE_API_KEY` in Vercel env (all targets); deep-mode query returns scoped results (globalreporting.org, ifrs.org) |
| google-search MCP | ✅ disabled | brave-search MCP covers the same need (key verified working, added to `~/.bashrc`) |
| GCP key rotation | ➡️ simplified | Google CSE no longer used anywhere — user just **deletes** the exposed key in GCP Console (no replacement needed), clearing the go-public gate |
| AI search generation broken (pre-existing) | ✅ fixed | stale `DEEPSEEK_API_KEY` in Vercel env; upserted the locally-verified key ×3 targets; prod streams full answers (439–496 chunks, no error events) |

## Optional items completion (2026-07-20)

| Item | Result |
|------|--------|
| Dependabot PRs #4–6 (upload-artifact v7, github-script v9, pnpm/action-setup v6) | ✅ all merged, pipelines green. Required fix: **Dependabot-triggered runs receive no repo secrets** — added `TOOL_PACKAGES_PAT` + `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` to the **Dependabot secrets store** (scoped to Dependabot runs only; `pull_request_target` correctly avoided — secret-exfiltration risk on a public repo) |
| Copilot auto-review (AC-C1) | ✅ **verified end-to-end**: ruleset auto-fired on PR #9 open; `copilot-pull-request-reviewer[bot]` posted a COMMENTED review unprompted |
| gitleaks CI job | ✅ removed via PR #9 (merged) — native secret scanning + push protection covers it |
| F19: playwright MCP | ✅ rewired to global binary (`@playwright/mcp` cli.js) — was npx cold-start failure |
| F19: postgres MCP | ✅ DB connection verified (`SELECT 1`); rewired to global binary with `{env:DATABASE_URL}` arg — was npx cold-start failure |
| F19: humanity4ai MCP | ✅ built `mcp-servers/dist` (tsc), rewired to `node dist/bin.js` — was tsx/pnpm cold-start failure |
| F19: n8n MCP | ✅ resolved 2026-07-20: OAuth-only server (API key irrelevant); user completed `opencode mcp auth n8n` — access token refreshed (valid, auto-renews via refresh token); static Bearer header removed from config |
| F19: perplexity MCP | ✅ rewired to global binary (`@perplexity-ai/mcp-server` dist/index.js) — was npx cold-start failure |
| F19: humanity4ai startup | ✅ root-caused + fixed 2026-07-20: `bin.ts` calls `main()` AND `mcp-server.ts` auto-runs `main()` on import → double `server.connect()` → fatal at boot. opencode now points at `dist/mcp-server.js` (single-connect path; valid JSON-RPC verified). **Upstream fix recommended in project_human:** remove the `main()` call from `bin.ts` (keep the auto-run) or vice versa. Timeout field note: opencode `timeout` = tools-fetch (default 5s), not boot |

## MCP final status (2026-07-20, ALL GREEN)

| Server | State | Verification |
|--------|-------|--------------|
| github | ✅ | get_me → simonplmak-cloud |
| browserless | ✅ | screenshot of prod via MCP |
| brave-search | ✅ | live query returns results (new key) |
| perplexity | ✅ | live query returns results (global binary) |
| esg-hub | ✅ | 354 pages via prod API |
| postgres | ✅ | `SELECT 1` + `postgres_query` tool |
| context7, gh_grep, clerk | ✅ | used throughout the project |
| playwright | ✅ | loads clean (global binary) |
| n8n | ✅ | OAuth refreshed by user; no startup failure |
| vercel | ✅ | OAuth valid; no startup failure |
| humanity4ai | ✅ | loads clean after double-`main()` fix (points at `dist/mcp-server.js`) |
| google-search | ⊘ disabled | intentionally replaced by Brave |
| google-workspace, ms-365 | ⊘ disabled | pending OAuth (out of scope) |

Future option noted: SurrealDB ships an official MCP (`surrealdb/surrealmcp` Docker image, surrealdb.com/mcp) — could give agents direct SurrealQL access to esg_hub if ever wanted.

Startup log after final restart: **zero `server unavailable` warnings** (2026-07-20 14:57+).
| MCP restart verification | pending next opencode restart (all binaries smoke-tested manually) |
| Deploys post-merge | ✅ 3/3 production deploys green after Dependabot merges |

1. **Enable Copilot** on simonplmak-cloud — ✅ DONE 2026-07-20: reviewer request for `copilot-pull-request-reviewer[bot]` now accepted on PR #4 (previously no-op'd). Ruleset `copilot_code_review` active → auto-requests on future PRs; review text generation is async (pending on PR #4 at log time; AC-C1 auto-fire to be confirmed on next PR)
2. **Vercel MCP OAuth** — ✅ DONE 2026-07-20: tokens stored in `~/.local/share/opencode/mcp-auth.json`; vercel MCP tools load on next opencode restart (AC-15 verification = one MCP call listing deployments)
3. **Refresh rejected API keys** in `~/.bashrc`: `BRAVE_API_KEY` (422 invalid) and `GOOGLE_API_KEY` (invalid) — search MCP servers themselves verified working. github + browserless verified ✓. (Optional: fix n8n/postgres/playwright/humanity4ai MCPs — see F19.)
3. **Rotate SurrealDB password** — committed fallback removed, but git history still contains it (until rotation, treat as exposed)
4. **Fix dead YouTube links** (@EFRAG, @TNFD_ → 404 even with browser UA) in DB content — tracked in issue #8
5. Review/merge Dependabot PRs #4–6 (action version bumps)
6. Decide: commit or gitignore `mcp-server/package-lock.json`

## Additional observations (documented, no action or deferred)

| Item | State | Note |
|------|-------|------|
| `scripts/translate-db-content.mjs` | 🟡 pre-existing broken | contains TypeScript (`interface`) in `.mjs` — never ran under `node`; pre-dates this work |
| Actions runner warning | 🟡 "Node.js 20 is deprecated… forced to run on Node.js 24" | runtime of the *actions* (checkout@v4 etc.), not our build; resolves as action maintainers ship node24 variants |
| `mcp-server/package-lock.json` untracked while `dist/` is tracked | 🟡 inconsistent | decide commit-or-ignore later; out of this spec's scope |
| Vercel `DEEPSEEK_API_KEY` preview value | ⚪ preview uses the development entry's value | acceptable; revisit if preview AI search misbehaves |
| humanity4ai gh account | ⚪ not stored in hosts.yml (token unrecoverable from files) | `gh auth login` manually if switching is ever needed |

# Implementation Plan — Development Environment Automation

Status: Draft (Gate 2 pending)
Version: 1.0
Last updated: 2026-07-19
Spec: `specs/dev-env-automation/spec.md` · Constitution: `constitution.md`

## Architecture Overview

Three planes, all changes declarative and revertible:

1. **Identity plane** — shell env (`~/.bashrc`), gh CLI multi-account, git credential helper, opencode MCP config
2. **GitHub plane** — repo settings via REST API (rulesets, vulnerability alerts, security analysis), workflow YAML, `.github/` templates, Dependabot config
3. **Vercel plane** — project settings via REST API (`nodeVersion`, `ssoProtection`), deploy mechanism moved into GitHub Actions build

Deploy flow after fix: `push main → check job (lint→tsc→vitest→build) → deploy job (checkout + tool_packages symlink → vercel pull/build --prod → vercel deploy --prebuilt --prod) → E2E vs live URL → notify n8n on failure`.

## Key Decisions

### D1 — Deploy fix: build in CI, deploy prebuilt (AC-A4)

Replace the API-trigger (`POST /v13/deployments` + gitSource + poll loop) with `vercel pull --environment=production` → `vercel build --prod` → `vercel deploy --prebuilt --prod` inside the existing `deploy` job.

- **Why:** the `file:../tool_package` deps exist only where CI creates the symlink. `deploy-preview.yml` already proves this path works. Build errors surface as normal step failures instead of a poll timeout.
- **Rejected:** (a) Vercel-side custom `installCommand` cloning tool_packages — spreads `TOOL_PACKAGES_PAT` into Vercel env, duplicates CI logic; (b) vendoring the packages — larger code churn, explicitly out of scope.
- **Consequence:** `specs/ci-cd-process` describes the API-trigger mechanism; amend it via `/sdd:amend` (task T-14). The `repoId`-based API contract file is superseded.

### D2 — GitHub identity (AC-A1, AC-A2)

- Append `SIMONPLMAK_CLOUD_PAT` to `~/.bashrc` (shell-level, consistent with existing secret hygiene).
- `gh auth login --with-token` adds `simonplmak-cloud` as a second gh account; `gh auth switch --user simonplmak-cloud` makes it active (work repos live there); `gh auth setup-git` replaces `credential.helper=store` with `!gh auth git-credential` so git push uses the active account.
- `opencode.json`: github MCP `GITHUB_PERSONAL_ACCESS_TOKEN` → `{env:SIMONPLMAK_CLOUD_PAT}`.
- **Trade-off:** gh's active account is host-global; pushing to humanity4ai-owned repos later requires `gh auth switch` (documented in AGENTS.md update, AC-B2).
- **Verification:** `gh api user` login, `gh api repos/...` 200, `git ls-remote origin` (AC-A1), MCP repo read (AC-A2).

### D3 — Branch protection + Copilot auto-review via one ruleset (AC-A13; AC-C1, AC-C2, AC-CE1)

Single repository ruleset `main-protection` via `POST /repos/simonplmak-cloud/esg-hub/rulesets`:

```json
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "non_fast_forward" },
    { "type": "required_status_checks", "parameters": { "required_status_checks": [{ "context": "check" }] } },
    { "type": "copilot_code_review" }
  ]
}
```

- `copilot_code_review` is the standalone rule from the 2025-09-10 changelog ("independent repository rule for automatic reviews"). It requests Copilot review automatically; it is advisory (AC-C2) because it is not a required reviewer.
- **Fallback (R3):** if the API rejects `copilot_code_review`, create the ruleset without it and document the one-time UI toggle (Settings → Rules → Rulesets) for the user. If Copilot has no subscription on the account, the rule simply never fires — no red checks (AC-CE1); user decides on purchase (ask-first boundary).
- Contract: `contracts/github-settings.md`.

### D4 — Vercel MCP via OAuth remote (AC-15)

Add to `opencode.json`: `"vercel": { "type": "remote", "url": "https://mcp.vercel.com", "enabled": true }`. The official server is **OAuth-only — no static-token header support** (verified via Vercel docs). First use triggers opencode's OAuth flow (browser consent).

- **Fallback (R4):** if OAuth can't complete in this environment, disable the MCP entry and document the CLI/API pattern used during this project (`curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/...`) in `log-review.md`, satisfying AC-15's documented-alternative clause.

### D5 — Script namespace safety (AC-A9)

New `scripts/lib/db-env.mjs` exporting `getDbEnv()`:

```js
export function getDbEnv() {
  const override = process.env.ESG_HUB_NS_OVERRIDE;
  const namespace = override || "esg_hub";   // never read SURREAL_NAMESPACE (foreign shells shadow it)
  if (override) console.warn(`⚠️  NAMESPACE OVERRIDE: targeting "${namespace}" (not esg_hub)`);
  return { endpoint: req("SURREAL_URL"), username: req("SURREAL_USERNAME"), password: req("SURREAL_PASSWORD"), database: req("SURREAL_DATABASE"), namespace };
}
```

All `scripts/*.mjs` that currently read `SURREAL_NAMESPACE` (or hardcode their own env reads) are mechanically switched to this helper. Contract shape fixed; per-script edits are mechanical.

### D6 — Supply chain: Dependabot + secret scanning (AC-D1…D4, AC-DE1)

- `.github/dependabot.yml`: `npm` (directory `/`, weekly, open-pull-requests-limit 5) + `github-actions` (weekly, limit 3).
- Enable via API: `PUT .../vulnerability-alerts`, `PUT .../automated-security-fixes`.
- Secret scanning + push protection: `PATCH /repos/...` with `security_and_analysis`. Free private repos may reject → fallback: add `gitleaks` job to `test.yml` (gitleaks-docker via `zricethezav/gitleaks` container or `gitleaks/gitleaks-action`), verdict logged (AC-D4).
- **R1:** Dependabot may fail on `file:../tool_package` deps → observe one weekly cycle; if erroring, drop the `npm` ecosystem entry (keep `github-actions`) and log the limitation (AC-DE1).

### D7 — Nightly maintenance workflow (AC-F1, AC-F2)

`.github/workflows/nightly.yml`, cron `17 18 * * *` (~02:17 HKT): (1) `node scripts/verify-db-schema.mjs` with SURREAL_* secrets; (2) smoke: `curl -sf` `/en` and `/api/v1` on the prod domain; (3) lychee broken-link check on key pages (`/en`, `/en/videos`, `/en/books`, `/api/v1`) with `--retry 2 --timeout 20 --accept 200,204,301,302,307,308,429` to avoid rate-limit flakiness (R8). On failure: dedup issue via `gh issue list --label nightly-alert` → create or comment.

### D8 — Failure notifications (AC-G1, AC-GE1)

Reusable step appended to `deploy.yml`, `test.yml`, `nightly.yml`:

```yaml
- name: Notify n8n on failure
  if: failure()
  continue-on-error: true
  run: curl -sf -X POST "$N8N_WEBHOOK_URL" -H 'Content-Type: application/json' -d '{"workflow":"${{ github.workflow }}","run":"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}","repo":"${{ github.repository }}"}' || true
  env:
    N8N_WEBHOOK_URL: ${{ secrets.N8N_WEBHOOK_URL }}
```

Non-blocking by construction (AC-GE1). Secret `N8N_WEBHOOK_URL` added via `gh secret set` once the user supplies the URL (prerequisite).

### D9 — On-demand test workflow (AC-B1)

`.github/workflows/test.yml` on `workflow_dispatch` with inputs `base_url` (default `https://esg-hub.ascent.partners`) and `skip_e2e` (boolean, default false). Mirrors the `check` job (incl. tool_packages checkout + symlink via `TOOL_PACKAGES_PAT`), then an E2E job with `BASE_URL` + `CI=true` unless skipped. Contract: `contracts/automation-workflows.md`.

### D10 — Code/doc fixes (AC-A8, AC-A11, AC-B2)

- `src/app/robots.ts:12`, `src/lib/constants.ts:7`, `src/app/videos/page.tsx:13,18` → `https://esg-hub.ascent.partners`; `mcp-server/README.md` default URL corrected. Verify: repo-wide grep = 0 hits (excluding `specs/`, `VERCEL_PROTECTION_FIX.md`, `AGENTS.md` history notes).
- Remove the password fallback at `scripts/verify-db-schema.mjs:13` → empty-string default (fails fast with a clear message via D5 helper).
- `AGENTS.md`: add "local E2E unsupported on this machine — use `test.yml` on GitHub" + env var rows (`SIMONPLMAK_CLOUD_PAT`, `VERCEL_TOKEN`) + gh account-switch note.

## Traceability (AC → component)

| AC | Component |
|----|-----------|
| A1 | D2 identity setup |
| A2 | D2 opencode.json github MCP |
| A3 | `~/.bashrc` VERCEL_TOKEN + API check |
| A4 | D1 deploy.yml rewrite (`contracts/deploy-workflow.md`) |
| A5 | existing E2E job kept after D1 |
| A6 | Vercel PATCH `nodeVersion: 22.x` |
| A7 | Vercel PATCH `ssoProtection` (payload verified at impl; dashboard fallback R5) |
| A8 | D10 code edits + grep |
| A9 | D5 `scripts/lib/db-env.mjs` + mechanical script updates |
| A10 | `scripts/add-unique-permalink-index.mjs` + run + verify (`data-model.md`) |
| A11 | D10 verify-db-schema.mjs edit |
| A12 | re-sweep appended to `log-review.md` |
| A13 | D3 ruleset |
| B1 | D9 `test.yml` |
| B2 | D10 AGENTS.md |
| C1, C2, CE1 | D3 ruleset |
| D1…D4, DE1 | D6 dependabot.yml + API enables (+gitleaks fallback) |
| E1 | `.github/PULL_REQUEST_TEMPLATE.md` |
| E2 | PR-title lint job (`contracts/automation-workflows.md`) |
| F1, F2 | D7 `nightly.yml` |
| G1, GE1 | D8 notify step ×3 workflows |
| MCP 14/15 | opencode.json edits (`contracts/opencode-mcp.md`), browserless service repair (R7) |

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R1 | Dependabot errors on `file:` deps | Med | one-cycle observation; drop npm ecosystem if broken; log verdict (AC-DE1) |
| R2 | No Copilot subscription on account | High (AC-C1) | ruleset without working rule fails silently (AC-CE1); ask-first purchase decision |
| R3 | Rulesets API rejects `copilot_code_review` | Med | create ruleset without it; document UI toggle for user |
| R4 | Vercel MCP OAuth impossible headless | Med | disable entry; document CLI alternative (AC-15 clause) |
| R5 | `ssoProtection` PATCH payload rejected/unclear | Med | verify post-PATCH; dashboard fallback steps for user |
| R6 | gh active-account switch breaks humanity4ai pushes | Low | documented `gh auth switch` in AGENTS.md |
| R7 | browserless container missing/unrepairable | Low | document start procedure or leave disabled with verdict |
| R8 | lychee flakes on external links (429) | Low | accept-list incl. 429, retries, limited URL set |
| R9 | Prebuilt deploy loses Vercel-side build env parity | Low | build runs `next build` with same Node 20 + frozen lockfile as gates |

## Sequencing (for tasks.md)

Phase 1 (WS-A+B): T-01…T-14 — identity → deploy fix → Vercel settings → code/DB/script fixes → test.yml → AGENTS.md → ci-cd-process amend.
Phase 2 (WS-C+D): ruleset, Dependabot, security toggles/gitleaks.
Phase 3 (WS-E+F+G): PR template, title lint, nightly, n8n notify, final re-sweep into log-review.md.

## Contracts (locked after Gate 2)

- `contracts/deploy-workflow.md` — rewritten `deploy` job
- `contracts/automation-workflows.md` — `test.yml`, `nightly.yml`, PR-title lint, notify step
- `contracts/github-settings.md` — ruleset JSON, Dependabot config, security API calls
- `contracts/opencode-mcp.md` — opencode.json MCP diff

## Test Strategy

Every change ships with its own live verification (per spec Boundaries): API GETs for settings, `gh run watch` for workflows, curl for endpoints, grep for dead-domain elimination, `verify:db` for DB. No new unit/E2E suites are added for infra changes; the existing Playwright suite remains the product-level regression gate (AC-A5, AC-B1).

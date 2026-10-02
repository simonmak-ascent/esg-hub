# Development Environment Automation — Local → GitHub → Vercel

Status: Approved (Gate 1 passed)
Version: 1.0
Last updated: 2026-07-19
Supersedes: `dev-env-alignment` draft v0.1 (never written to disk)

## Overview

Align and automate the software development environment — local machine → GitHub → Vercel → SurrealDB: correct account access, repaired production deploys, verified-clean logs, and an automation layer covering AI code review, dependency/security updates, PR hygiene, scheduled maintenance, and failure notifications. GitHub runners act as the test executor because the local machine is too slow to run tests.

## Evidence Baseline (2026-07-19 log sweep)

Full details in `log-review.md`. Summary:

| # | Finding | Evidence |
|---|---------|----------|
| F1 | 6 consecutive `Deploy to Vercel` failures on main; prod serves the 2026-03-01 build | Actions runs 29674763034–29677821061; Vercel deployments 6×ERROR |
| F2 | Vercel build fails: `pnpm install` exit 254 ENOENT — `file:../tool_package` absent on Vercel builders; regression introduced by adding `pnpm-lock.yaml` (npm had tolerated it) | Vercel API errorCode/errorStep; lockfile history at dc21ae1 vs c9bffd4 |
| F3 | Vercel project `nodeVersion: 24.x` violates `engines: >=18 <24` | Vercel project API |
| F4 | `ssoProtection: all_except_custom_domains` — preview URLs will fail E2E unauthenticated | Vercel project API; VERCEL_PROTECTION_FIX.md |
| F5 | No branch protection on `main` | Branch protection API 404 |
| F6 | Repo secrets complete (9/9 expected) | `gh secret list` |
| F7 | gh/git/github-MCP authenticate as `humanity4ai` — no access to `simonmak-ascent/esg-hub` (404s) | gh auth status; API 404s |
| F8 | Shell `SURREAL_NAMESPACE=valuation` — `scripts/*.mjs` target the wrong DB (verify reported "0 pages") | verify-db-schema.mjs with/without override |
| F9 | DB healthy except: no UNIQUE index on `page.permalink` | verify:db (correct ns): 354 pages, indexes ok |
| F10 | `verify-db-schema.mjs:13` committed password fallback | file read |
| F11 | 4 references to dead domain `esg-hub-six.vercel.app` (robots.ts:12, videos/page.tsx:13,18, constants.ts:7, mcp README) | grep |
| F12 | MCPs: perplexity ✓; github → wrong account; brave-search/google-search disabled (keys set); browserless service down; no Vercel MCP; google-workspace/ms-365 disabled pending OAuth | opencode.json; live tests |
| F13 | No way to run tests on GitHub without push/PR | workflow triggers |
| F14 | Zero automation baseline: no Dependabot (alerts 404, auto-fixes off), no PR template, no secret scanning/CodeQL, only 2 workflow files | API checks; `.github/` listing |

## User Stories

- As a **developer**, I want git, gh CLI, and the github MCP to authenticate as `simonmak-ascent` so that I can push, inspect runs, and manage the repo from this machine.
- As a **developer**, I want to trigger the full test suite on GitHub on demand so that I never run tests on this slow local machine.
- As a **maintainer**, I want production deploys green again, `main` protected, dependency/security PRs arriving automatically, a nightly job watching prod + DB, and failures reaching me via n8n.
- As a **reviewer**, I want every PR to automatically receive a Copilot review before I look at it.
- As an **AI-agent operator**, I want every configured MCP server reachable and verified so that agent workflows don't silently use dead endpoints.

## Boundaries

**Always do:**
- Store tokens and webhook URLs only as shell env vars (`~/.bashrc`), GitHub secrets, or Vercel env — never repo files
- Verify every change with a live read-only check before marking it done; record results in `specs/dev-env-automation/log-review.md`
- Keep `pnpm` everywhere; keep the CI gate order from `specs/ci-cd-process` (lint → tsc → vitest → build)
- Keep `verify:db` non-blocking in CI (per ci-cd-process AC-7)
- Bot-created PRs pass through the same CI gate as human PRs

**Ask first (do not proceed unilaterally):**
- Purchasing subscriptions (Copilot, GitHub Advanced Security)
- Installing GitHub Apps; enabling auto-merge; adding required reviewers
- Changing production domains/aliases or disabling protection on custom domains
- Rotating or deleting existing secrets
- Modifying `specs/ci-cd-process` contracts (update that spec via `/sdd:amend` instead)

**Never do:**
- Auto-merge without green checks
- Grant third-party apps repo access without approval
- Commit tokens, webhook URLs, or `.env` content to the repository
- Run any mutation script against a namespace other than `esg_hub` without explicit override
- Leave a found log error unexplained (fix or document with owner)

## Acceptance Criteria

### WS-A: Foundation & Alignment (Phase 1)

- **AC-A1 [MUST]** Given the simonmak-ascent PAT stored as a shell env var, when `gh api repos/simonmak-ascent/esg-hub`, `gh run list`, and `git ls-remote origin` run, then all succeed (HTTP 200 / ref listing). And `gh api user` in the configured context reports login `simonmak-ascent` (no silent fallback to `humanity4ai`).
- **AC-A2 [MUST]** Given the github MCP configured with the simonmak-ascent credential, when an MCP repo-read is invoked for `simonmak-ascent/esg-hub`, then repository data returns (not 404).
- **AC-A3 [MUST]** Given `VERCEL_TOKEN` as a shell env var, when the deployments API is queried, then the deployment list returns.
- **AC-A4 [MUST]** Given a push to `main`, when the deploy workflow completes, then the Vercel production deployment reaches `READY`, the workflow conclusion is `success`, and `https://esg-hub.ascent.partners/en` serves the new build. (Mechanism deferred to plan.md; recommendation: prebuilt-in-CI mirroring deploy-preview.yml. This spec's approval covers the ci-cd-process "ask first" clause; a task amends that spec via `/sdd:amend`.)
- **AC-A5 [MUST]** Given the deployment is READY, when E2E runs against it, then failures still block the pipeline (preserves ci-cd-process AC-4).
- **AC-A6 [SHOULD]** Given `engines: >=18 <24`, when the Vercel project `nodeVersion` is inspected, then it lies within range (target: 22.x, matching `.nvmrc`).
- **AC-A7 [SHOULD]** Given a PR preview deployment, when Playwright requests the preview URL without interactive login, then it receives HTTP 200 (protection disabled for previews or automation-bypass configured).
- **AC-A8 [MUST]** When the repo is grepped for `esg-hub-six.vercel.app`, then zero references remain outside historical docs; `robots.ts` sitemap and all canonical/OG URLs use `https://esg-hub.ascent.partners`.
- **AC-A9 [MUST]** Given `SURREAL_NAMESPACE=valuation` in the shell, when `pnpm verify:db` (or any `scripts/*.mjs`) runs, then it targets `esg_hub` unless an explicit override is passed; when the override is used, a prominent warning names the target namespace.
- **AC-A10 [MUST]** When the DB schema is verified, then a UNIQUE index exists on `page.permalink` and `verify:db` reports zero warnings.
- **AC-A11 [MUST]** `scripts/verify-db-schema.mjs` contains no hardcoded credential fallback.
- **AC-A12 [MUST]** Given the F1–F14 baseline, when implementation completes, then a re-sweep (last 10 Actions runs, last 10 Vercel deployments, `verify:db`, prod smoke checks) shows every item resolved or documented with owner/rationale in `log-review.md`.
- **AC-A13 [SHOULD]** `main` is protected: force-pushes blocked and the CI `check` status required (ruleset `main-protection`); verified via the rulesets API. (Restored from approved draft AC-16 — dropped during renumbering, reinstated 2026-07-19.)

### WS-B: On-Demand Testing (Phase 1)

- **AC-B1 [MUST]** Given no PR or push, when a maintainer manually triggers the test workflow (`workflow_dispatch`), then lint → typecheck → unit tests run on GitHub runners and report conclusion; and E2E runs against a URL input defaulting to production.
- **AC-B2 [SHOULD]** `AGENTS.md` states local E2E is unsupported on this machine, points to the manual workflow, and documents the new env vars (`SIMONMAK_ASCENT_PAT`, `VERCEL_TOKEN`).

### WS-C: Automated Code Review (Phase 2)

- **AC-C1 [MUST]** Given a PR opened against main, when the PR is ready, then a Copilot code review is automatically requested and Copilot's review appears on the PR.
- **AC-C2 [SHOULD]** Copilot review is advisory — never a required/blocking check.
- **AC-CE1 [MUST]** If Copilot is unavailable on the account, the request mechanism fails gracefully (no red check on PRs) and the gap is reported to the user for a fallback decision.

### WS-D: Dependencies & Supply Chain (Phase 2)

- **AC-D1 [MUST]** `.github/dependabot.yml` exists: weekly `npm` + `github-actions` updates with a sane open-PR limit.
- **AC-D2 [MUST]** Dependabot vulnerability alerts are enabled (API returns 204).
- **AC-D3 [SHOULD]** Automated security fixes are enabled.
- **AC-D4 [SHOULD]** Secret scanning + push protection enabled where the plan allows; otherwise a gitleaks CI workflow plus a documented plan-limitation verdict in `log-review.md`.
- **AC-DE1 [SHOULD]** Dependabot behavior with `file:../tool_package` deps is observed for one cycle: update PRs flow, or the limitation is documented in `log-review.md`.

### WS-E: PR Hygiene (Phase 3)

- **AC-E1 [MUST]** `.github/PULL_REQUEST_TEMPLATE.md` exists with an SDD spec-reference section and renders on new PRs.
- **AC-E2 [SHOULD]** A PR-title conventional-commit lint check (`feat|fix|ci|chore|docs|refactor|test|perf`) fails the check on non-conforming titles.

### WS-F: Scheduled Maintenance (Phase 3)

- **AC-F1 [MUST]** A nightly cron workflow runs `verify:db` + prod smoke (`/en`, `/api/v1`) + a lychee broken-link sweep; a green run is recorded.
- **AC-F2 [SHOULD]** On failure, the workflow opens (or updates) a deduplicated GitHub issue.

### WS-G: Notifications (Phase 3) — DEFERRED

- **AC-G1 [WONT — this iteration]** Deploy/test/nightly workflow failure POSTs to the n8n webhook. *Deferred 2026-07-19 per user decision (no webhook URL provided; GitHub email/UI notifications suffice for now). Revisit by re-scoping WS-G when an n8n webhook is available.*
- **AC-GE1 [WONT — this iteration]** Webhook outage never fails the workflow (moot while AC-G1 deferred).

## Non-Functional Requirements

- **Auditability:** every settings change (GitHub, Vercel) recorded in `log-review.md` with before/after values
- **Reversibility:** all GitHub/Vercel setting changes revertible via the same API/console
- **Idempotency:** scheduled and notify jobs safe to re-run; issue creation is deduplicated
- **Secret hygiene:** secret scan of the repo returns zero hits after all changes
- **Compatibility:** existing CI gate order and `specs/ci-cd-process` contracts preserved

## Out of Scope

- Auto-merge of bot PRs; CODEOWNERS/required human reviewers; issue templates & stale bot (solo repo)
- Release/changelog automation; GitHub Apps beyond Copilot; Advanced Security purchase
- OAuth setup for google-workspace / ms-365 MCPs (remain disabled)
- SurrealDB password rotation (manual follow-up after AC-A11)
- Vendoring/publishing `@simonmak-ascent/*` packages (revisit only if the deploy fix proves fragile)
- `vercel.json` no-op rewrite cleanup; DNS/domain changes
- Node version policy beyond Vercel pinning (engines vs `.nvmrc` vs CI mismatch documented, not changed)

## Open Questions

- [RESOLVED] GitHub credential → user-provided PAT (verified: login `simonmak-ascent`, scopes `repo`, `workflow`)
- [RESOLVED] Vercel access → user-provided token (verified) + add Vercel MCP
- [RESOLVED] Disabled MCPs → enable brave-search/google-search, repair browserless
- [RESOLVED] DB index + namespace fixes → in scope (single spec)
- [RESOLVED] Extension: single spec `dev-env-automation`; Copilot review; Dependabot tolerate-errors; n8n webhook notifications
- [OPEN] n8n webhook URL — user provides at implementation time
- [OPEN] Copilot subscription active on simonmak-ascent? — verified at implementation (AC-CE1 fallback if absent)

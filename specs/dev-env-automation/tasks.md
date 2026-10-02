# Tasks — Development Environment Automation

Status: Draft (Gate 3 pending)
Version: 1.0
Last updated: 2026-07-19
Plan: `plan.md` · Contracts: `contracts/` (locked)

Conventions: each task = one commit-or-PR unit; **Verify** line is the task's test (live read-back per plan Test Strategy); `[P]` = parallelizable with same-phase tasks; S/M/L ≈ <15min / 15–45min / >45min.

Repo-change tasks are batched into one PR per phase (PR-1, PR-2, PR-3) — merges verify the workflows end-to-end. Settings/API/local changes happen independently of PRs.

---

## Phase 1 — WS-A + WS-B (unbreak prod, restore access)

| # | Task | Size | Verify |
|---|------|------|--------|
| T-01 | Append `SIMONMAK_ASCENT_PAT` + `VERCEL_TOKEN` exports to `~/.bashrc` | S | new shell: `printenv` both set |
| T-02 | gh: `gh auth login --with-token`, `gh auth switch --user simonmak-ascent`, `gh auth setup-git` | S | **AC-A1**: `gh api user` login = simonmak-ascent; `gh api repos/simonmak-ascent/esg-hub` 200; `git ls-remote origin` lists refs |
| T-03 [P] | Vercel: PATCH `nodeVersion: "22.x"` (project esg-hub, teamId from `.vercel/project.json`) | S | **AC-A6**: GET shows `22.x`; log before/after |
| T-04 [P] | Vercel: PATCH `ssoProtection` off for previews (payload per contracts/github-settings.md §5; dashboard fallback R5) | M | **AC-A7**: GET read-back logged; full proof = next preview URL returns 200 unauthenticated (noted as pending) |
| T-05 [P] | Rewrite `deploy` job in `.github/workflows/deploy.yml` per `contracts/deploy-workflow.md` | M | YAML parses; contract review; end-to-end proof at PR-1 merge (**AC-A4**, **AC-A5**) |
| T-06 [P] | Dead-domain fixes: `src/app/robots.ts:12`, `src/lib/constants.ts:7`, `src/app/videos/page.tsx:13,18`, `mcp-server/README.md` | S | **AC-A8**: `grep -r "esg-hub-six" src/ mcp-server/README.md` = 0 hits |
| T-07 [P] | Remove password fallback in `scripts/verify-db-schema.mjs:13` | S | **AC-A11**: file has no fallback; script fails fast with clear message when env missing |
| T-08 | New `scripts/lib/db-env.mjs` (D5) + migrate all `scripts/*.mjs` reading `SURREAL_NAMESPACE` to it | M | **AC-A9**: `SURREAL_NAMESPACE=valuation node scripts/verify-db-schema.mjs` → reports esg_hub stats (354 pages); override path prints warning |
| T-09 | New `scripts/add-unique-permalink-index.mjs`; run it (DB mutation — confirm before run per Boundaries) | S | **AC-A10**: `INFO FOR TABLE page` shows `unique_permalink`; `pnpm verify:db` zero warnings |
| T-10 | New `.github/workflows/test.yml` per `contracts/automation-workflows.md` §1 | M | after PR-1 merge: `gh workflow run` → run green (**AC-B1**) |
| T-11 | `AGENTS.md`: GitHub-as-test-runner note, env var rows (`SIMONMAK_ASCENT_PAT`, `VERCEL_TOKEN`), `gh auth switch` note | S | **AC-B2**: content present |
| T-12 [P] | `opencode.json` (backup first): github MCP → `{env:SIMONMAK_ASCENT_PAT}`; enable brave-search, google-search; add vercel remote MCP per `contracts/opencode-mcp.md` | M | **AC-A2**: MCP repo read returns data; **AC-14**: live query per search MCP; **AC-15**: OAuth attempt or CLI-fallback verdict |
| T-13 [P] | browserless: inspect (`docker ps -a`), start/repair service, verify `curl localhost:3000`, then enable MCP | S | live MCP call, or R7 verdict logged |
| T-14 | `/sdd:amend` `specs/ci-cd-process` — replace API-trigger mechanism with prebuilt-in-CI; supersede `contracts/vercel-api.md`; bump version | S | spec diff reviewed |

**PR-1** (contains T-05, T-06, T-07, T-08, T-09-script, T-10, T-11, T-14 + `specs/dev-env-automation/` artifacts): merge → **AC-A4/A5 proof**: workflow success, Vercel deployment READY, prod serves new build → then dispatch `test.yml` (**AC-B1**) → log all to `log-review.md`.

Depends on: T-01, T-02 (all API/local tasks); PR-1 merge gates T-15.

---

## Phase 2 — WS-C + WS-D

| # | Task | Size | Verify |
|---|------|------|--------|
| T-15 | Create ruleset `main-protection` via API per `contracts/github-settings.md` §1 (includes `copilot_code_review`; R3 fallback = ruleset without it + UI instructions to user). **GATE-3 DECISION REQUIRED: strict vs bypass (see below)** | S | **AC-A13**: GET rulesets shows active; **AC-C1**: Copilot review auto-requests on PR-2; **AC-C2**: not a required check; **AC-CE1**: absence of subscription = silent, reported to user |
| T-16 [P] | `.github/dependabot.yml` per contract §2 + `PUT vulnerability-alerts` + `PUT automated-security-fixes` | S | **AC-D1**: file merged; **AC-D2**: GET alerts → 204; **AC-D3**: GET → `enabled:true` |
| T-17 [P] | Secret scanning + push protection PATCH; on rejection → add `gitleaks` job to `test.yml` + log plan-limitation verdict | S | **AC-D4**: GET shows enabled, or gitleaks job present + verdict logged |
| T-18 (obs) | Dependabot one-cycle observation (~1 week): PRs flow or file-deps limitation documented | S | **AC-DE1**: verdict in `log-review.md` (non-blocking pending item) |

**PR-2** (contains T-16 file + T-17 gitleaks-if-fallback): merge. PR-2 doubles as the AC-C1 test (Copilot review should appear automatically).

Depends on: PR-1 merged (workflows green); T-15 ordered before PR-2 so PR-2 exercises the ruleset.

---

## Phase 3 — WS-E + WS-F + WS-G + close-out

| # | Task | Size | Verify |
|---|------|------|--------|
| T-19 [P] | `.github/PULL_REQUEST_TEMPLATE.md` per contract §4 | S | **AC-E1**: template renders on next PR |
| T-20 [P] | `.github/workflows/pr-title.yml` per contract §3 | S | **AC-E2**: non-conforming title fails check (test on PR-3 itself — title intentionally conforming; rely on grep logic review + one edited-title experiment if desired) |
| T-21 [P] | `.github/workflows/nightly.yml` per contract §2 | M | **AC-F1**: `gh workflow run nightly.yml` → green; **AC-F2**: dedup-issue logic reviewed (failure path exercised only if a check fails) |
| T-22 | ~~n8n notify step + secret~~ **CANCELLED 2026-07-19** — user deferred WS-G (no webhook URL); spec AC-G1/GE1 → WONT this iteration | — | — |
| T-23 | Final re-sweep (**AC-A12**): last 10 Actions runs, last 10 Vercel deployments, `verify:db`, prod smoke, MCP table, settings read-backs → complete Resolution Log in `log-review.md`; drift check vs spec.md | M | every F-item resolved or documented; Phase 5 validate report |

**PR-3** (contains T-19, T-20, T-21): merge → close-out.

---

## Gate 3 review checklist

- [x] Tasks atomic, ≤3 files each (T-08 is the one broad mechanical sweep — single pattern, reviewed as a unit)
- [x] Every task carries its verification (live read-back per plan Test Strategy)
- [x] Dependencies form a DAG (identity → phase-1 fixes → PR-1 → ruleset → PR-2 → phase-3 → re-sweep)
- [x] Ruleset sequenced AFTER workflow fixes are green (avoids self-lockout)
- [x] Blocked item explicit (T-22 needs n8n webhook URL)

## Open decision (must resolve before T-15)

**Ruleset strictness** — [RESOLVED 2026-07-19] Pragmatic bypass: repo admin is a `bypass_actors` entry (direct pushes stay possible); `non_fast_forward` and `copilot_code_review` apply normally. Contract updated.

## Prerequisites outstanding

- n8n webhook URL (T-22) — provide before Phase 3.

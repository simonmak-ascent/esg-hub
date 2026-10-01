# Technical Plan: CI/CD Pipeline

## Spec Reference
Implements: `specs/ci-cd-process/spec.md`

## Architecture Overview

Two GitHub Actions workflows share a common quality gate (lint → typecheck → Vitest → build), then diverge: PRs get Vercel CLI preview deploys, main pushes get production deploys via Vercel REST API followed by E2E verification. Both use `pnpm` and block on failures.

## Component Breakdown

### 1. deploy.yml (Production — main push)

**Trigger:** `push: branches: [main]`

**Job 1: check**
- Responsibility: Quality gate — validates code before any deploy
- Steps (sequential, blocking):
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` + `actions/setup-node@v4` (cache: pnpm)
  3. `pnpm install --frozen-lockfile`
  4. `pnpm lint`
  5. `npx tsc --noEmit`
  6. `npx vitest run`
  7. `pnpm verify:db` (non-blocking, env vars from secrets)
  8. `pnpm build` (validates production build + env vars from secrets)
- AC Coverage: AC-1, AC-6, AC-7, AC-8, AC-E3, AC-E4

**Job 2: deploy (needs: check)**
- Responsibility: Trigger Vercel production deploy via REST API, wait for READY, then run E2E
- Note: `needs: check` ensures this job only runs if the quality gate passes. GitHub Actions jobs run on separate ephemeral runners — checkout and install must be repeated here.
- Steps:
  1. Trigger Vercel deployment via `POST /v13/deployments` (id: trigger)
     - Body: `{ name, project, target: "production", gitSource: { type, repoId, ref, sha } }`
     - Outputs: `deploy_id`, `deploy_url`
  2. Poll `GET /v13/deployments/{id}` until `readyState === "READY"` (max 30 polls × 10s = 5min)
     - If `ERROR` or `CANCELED`: fail immediately (AC-E1, AC-E2)
  3. `actions/checkout@v4` for test files
  4. `pnpm/action-setup@v4` + `actions/setup-node@v4`
  5. `pnpm install --frozen-lockfile`
  6. `npx playwright install chromium`
  7. `npx playwright test` with `BASE_URL=${{ steps.trigger.outputs.deploy_url }}`
  8. Upload Playwright report as artifact (`playwright-report/`)
- AC Coverage: AC-3, AC-4, AC-E1, AC-E2, AC-8

### 2. deploy-preview.yml (PR)

**Trigger:** `pull_request: branches: [main]`

**Job 1: check**
- Responsibility: Quality gate before preview deploy
- Steps (sequential, blocking):
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` + `actions/setup-node@v4` (cache: pnpm)
  3. `pnpm install --frozen-lockfile`
  4. `pnpm lint`
  5. `npx tsc --noEmit`
  6. `npx vitest run`
  7. `pnpm build` (validates production build; needs `SURREAL_*` env vars from secrets)
- Differs from production check: NO `verify:db` step (DB verification is irrelevant for PR previews)
- AC Coverage: AC-1, AC-6, AC-E3, AC-E4

**Job 2: deploy-preview (needs: check)**
- Responsibility: Build, deploy preview on Vercel, run E2E verification
- Note: `needs: check` ensures this job only runs if the quality gate passes. GitHub Actions jobs run on separate ephemeral runners — checkout and install must be repeated here.
- Steps:
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` + `actions/setup-node@v4`
  3. `pnpm install --frozen-lockfile`
  4. `pnpm add -g vercel@latest`
  5. `vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}`
  6. `vercel build --token=${{ secrets.VERCEL_TOKEN }}`
  7. `vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}` (output: deploy_url)
  8. Comment PR with deploy URL via `actions/github-script@v7`
  9. `npx playwright install chromium`
  10. `npx playwright test` with `BASE_URL=${{ steps.vercel.outputs.deploy_url }}`
  11. Upload Playwright report as artifact (`playwright-report/`)
- AC Coverage: AC-2, AC-5, AC-8

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package manager | `pnpm` with `pnpm/action-setup@v4` | Matches local dev, mandated by constitution |
| Quality gate order | lint → tsc → vitest → build | Fast failures first; lint (<5s) catches before tsc (10s) catches before tests (30s) catches before full build (2min) |
| Pnpm setup in CI | `pnpm/action-setup@v4` before `setup-node` | `pnpm/action-setup` must run before `setup-node` can configure its cache for pnpm |
| Production deploy | Vercel REST API (`POST /v13/deployments`) | Proven approach from current workflow; builds on Vercel infra, avoids GitHub Actions env mismatch |
| Preview deploy | Vercel CLI (`vercel build` + `vercel deploy --prebuilt`) | Proven approach for PR previews; CLI handles env var injection from Vercel project |
| E2E framework | Playwright (existing) | Already configured; `BASE_URL` env var routes tests to deployed URL in CI |
| Job orchestration | `needs: check` dependency | Deploy only runs if quality gate passes; atomic per spec AC-1 |
| No reusable workflow | Duplicate check job in both workflows | Two workflows only; reusable adds indirection without reducing maintenance burden |

## Integration Points

- **Vercel REST API:** `POST /v13/deployments?teamId=<orgId>` creates deployment from git SHA; `GET /v13/deployments/{id}` polls status. Contract in `contracts/vercel-api.md`.
- **GitHub Secrets:** `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`, `SURREAL_URL`, `SURREAL_USERNAME`, `SURREAL_PASSWORD`, `SURREAL_DATABASE`. Config reference in `data-model.md`.
- **GitHub Actions contexts:** `github.ref_name` (branch), `github.sha` (commit), `steps.<id>.outputs` (deploy URL propagation between steps)

## AC Coverage Map

| AC | Workflow | Job(s) |
|----|----------|--------|
| AC-1 (quality gate) | Both | check |
| AC-2 (preview deploy) | deploy-preview | deploy-preview |
| AC-3 (production deploy) | deploy | deploy (trigger + poll) |
| AC-4 (E2E vs production) | deploy | deploy (playwright step) |
| AC-5 (E2E vs preview) | deploy-preview | deploy-preview (playwright step + artifact upload) |
| AC-6 (pnpm throughout) | Both | check + deploy jobs |
| AC-7 (DB verify non-blocking) | deploy | check |
| AC-8 (secret hygiene) | Both | All steps |
| AC-9 (PR check runs) | Both | GitHub built-in |
| AC-E1 (timeout) | deploy | deploy (poll loop) |
| AC-E2 (Vercel error) | deploy | deploy (poll loop) |
| AC-E3 (type errors block) | Both | check |
| AC-E4 (lint violations block) | Both | check |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| No `pnpm-lock.yaml` exists | Certain | High | Generate before switching CI: `rm package-lock.json && pnpm install` |
| Vercel API rate limits | Low | Medium | 30 polls over 5 min is well within Vercel's API limits; add exponential backoff if needed |
| `SURREAL_*` secrets missing from GitHub | Medium | Medium | `verify:db` is non-blocking (AC-7); `pnpm build` may fail if DB env vars are needed at build time — both production and preview check jobs need these secrets; test build in CI first |
| Preview `vercel build` fails due to env mismatch | Medium | Medium | Known historical issue; if it recurs, switch preview to API trigger like production |
| Playwright browser install slow | Medium | Low | Cache Playwright browsers via `actions/cache@v4` or GitHub's built-in Playwright caching |
| Node version mismatch | Low | Low | Pin to `20` in `setup-node`; matches `engines` in `package.json` |

## Prerequisites

1. **Generate `pnpm-lock.yaml`:** `rm package-lock.json && pnpm install` (must be committed)
2. **Verify GitHub secrets exist:** `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`, all `SURREAL_*` vars
3. **Verify `pnpm build` works with env vars:** Test that `next build` passes with `SURREAL_*` secrets set (may need at build time for SSR pages)

## Out of Scope (Technical)

- No reusable workflow (`.github/workflows/_quality-gate.yml`) — two workflows, duplication is acceptable
- No caching layer beyond pnpm store cache (`setup-node` handles this)
- No Playwright browser caching (can add `actions/cache` in future optimization)
- No matrix builds (single Node version, single OS)

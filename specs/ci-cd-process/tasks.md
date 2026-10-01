# Task List: CI/CD Pipeline

## Plan Reference
Implements: `specs/ci-cd-process/plan.md`

## Tasks

### Prerequisites

- [ ] **TASK-001** [M] Generate pnpm-lock.yaml
  - Creates: `pnpm-lock.yaml` (new), removes `package-lock.json` (deleted)
  - Command: `rm package-lock.json && pnpm install`
  - Verify: `test -f pnpm-lock.yaml && ! test -f package-lock.json && pnpm run dev --version` (exit 0)
  - Depends on: none
  - Notes: Must be committed before any CI workflow changes — both workflows use `pnpm install --frozen-lockfile`
  - AC Coverage: AC-6 (enables pnpm in CI)

### Production Workflow (deploy.yml)

- [ ] **TASK-002** [M] Rewrite deploy.yml check job
  - Modifies: `.github/workflows/deploy.yml` (check job section only)
  - Changes:
    - Switch `setup-node` cache from `npm` to `pnpm`
    - Add `pnpm/action-setup@v4` before `setup-node`
    - Replace `npm ci` with `pnpm install --frozen-lockfile`
    - Replace `npm run lint` with `pnpm lint` (remove `continue-on-error: true`)
    - Keep `npx tsc --noEmit` (already blocking)
    - Add `npx vitest run` step (blocking)
    - Move `pnpm verify:db` after tests, keep `continue-on-error: true`
    - Add `pnpm build` step (blocking, with `SURREAL_*` env vars)
    - Remove unused `npm run` references
  - Contract: `specs/ci-cd-process/contracts/vercel-api.md` (N/A — check job doesn't touch API)
  - Verify: YAML syntax valid (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"`); `pnpm lint && npx tsc --noEmit && npx vitest run && pnpm build` passes locally
  - Depends on: TASK-001
  - AC Coverage: AC-1, AC-6, AC-7, AC-8, AC-E3, AC-E4

- [ ] **TASK-003** [M] Rewrite deploy.yml deploy job
  - Modifies: `.github/workflows/deploy.yml` (deploy job section only)
  - Changes:
    - Switch to `pnpm/action-setup@v4` + `pnpm install --frozen-lockfile`
    - Replace `npm ci` with `pnpm install --frozen-lockfile`
    - Replace `npx playwright install chromium` with `pnpm exec playwright install chromium`
    - Replace `npx playwright test` with `pnpm playwright test` (remove `continue-on-error: true`)
    - Add Playwright report artifact upload (`actions/upload-artifact@v4`)
    - Keep Vercel API trigger + poll logic (unchanged)
    - Keep checkout between trigger and E2E (separate runner)
  - Verify: YAML syntax valid; inspect YAML — trigger body matches contract, polling covers ERROR/CANCELED/READY/timeout, no `continue-on-error` on E2E
  - Depends on: TASK-002
  - AC Coverage: AC-3, AC-4, AC-6, AC-8, AC-E1, AC-E2

### Preview Workflow (deploy-preview.yml)

- [ ] **TASK-004** [M] [P] Rewrite deploy-preview.yml check job
  - Modifies: `.github/workflows/deploy-preview.yml` (adds check job)
  - Changes:
    - Add `check` job (currently only has `deploy-preview` job)
    - Steps: checkout → pnpm/setup-node → install → lint (blocking) → tsc → vitest → build (with `SURREAL_*` env vars)
    - Do NOT add `verify:db` step (only for production)
  - Verify: YAML syntax valid (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-preview.yml'))"`); `pnpm lint && npx tsc --noEmit && npx vitest run && pnpm build` passes locally
  - Depends on: TASK-001
  - AC Coverage: AC-1, AC-6, AC-E3, AC-E4

- [ ] **TASK-005** [M] Rewrite deploy-preview.yml deploy-preview job
  - Modifies: `.github/workflows/deploy-preview.yml` (deploy-preview job section)
  - Changes:
    - Add `needs: check` to make it depend on TASK-004's check job
    - Switch to `pnpm/action-setup@v4` + `pnpm install --frozen-lockfile`
    - Replace `npm ci` with `pnpm install --frozen-lockfile`
    - Replace `npm install --global vercel` with `pnpm add -g vercel`
    - Add E2E steps after deploy: `pnpm exec playwright install chromium` → `pnpm playwright test` (blocking, no `continue-on-error`)
    - Add Playwright report artifact upload (`actions/upload-artifact@v4`)
    - Keep vercel CLI pull/build/deploy/comment (unchanged)
    - Add `BASE_URL` env var from vercel deploy step output for E2E
  - Verify: YAML syntax valid; inspect YAML — `needs: check` present, no `npm` references, E2E step has no `continue-on-error`, artifact step present
  - Depends on: TASK-004
  - AC Coverage: AC-2, AC-5, AC-6, AC-8

### Verification

- [ ] **TASK-006** [S] Verify secret hygiene in both workflows
  - Checks: `.github/workflows/deploy.yml`, `.github/workflows/deploy-preview.yml`
  - Validation:
    - `rg 'secrets\.' .github/workflows/` shows all secrets use `${{ secrets.X }}` syntax
    - `rg -v 'secrets\.' .github/workflows/ | rg 'VERCEL_TOKEN\|SURREAL_PASSWORD\|SURREAL_URL'` returns no hardcoded values
    - No `.env` file reads in workflows
  - Depends on: TASK-003, TASK-005
  - AC Coverage: AC-8

- [ ] **TASK-007** [S] Validate pnpm-lock.yaml integrity
  - Validates: `pnpm-lock.yaml`
  - Command: `pnpm install --frozen-lockfile` (should exit 0 with no changes)
  - Depends on: TASK-001
  - Notes: Confirms lockfile matches `package.json` exactly

## Dependencies Graph

```
TASK-001 (pnpm-lock.yaml)
├── TASK-002 (deploy.yml check) ── TASK-003 (deploy.yml deploy) ──┐
└── TASK-004 (preview check) [P] ── TASK-005 (preview deploy) ──┤
                                                                   ├── TASK-006 (secrets hygiene)
TASK-001 ────────────────────────────────────────────────────────── TASK-007 (lockfile integrity)
```

## Legend
- `[S]` Small — under 30 minutes
- `[M]` Medium — 30–90 minutes
- `[L]` Large — 90+ minutes (consider splitting)
- `[P]` Parallelizable — can run concurrently with other `[P]` tasks at same level

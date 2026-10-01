# Data Model: CI/CD Configuration

## Spec Reference
Implements: `specs/ci-cd-process/spec.md`

## GitHub Repository Secrets

All secrets are stored in GitHub repo → Settings → Secrets and variables → Actions.

| Secret Name | Used By | Required | Notes |
|------------|---------|----------|-------|
| `VERCEL_ORG_ID` | Both workflows | Yes | Vercel team ID (passed as `?teamId=` query param) |
| `VERCEL_PROJECT_ID` | Both workflows | Yes | Vercel project ID |
| `VERCEL_TOKEN` | Both workflows | Yes | Vercel personal access token (full account scope) |
| `SURREAL_URL` | Both workflows (check jobs) | No | SurrealDB Cloud URL; needed for `pnpm build` (SSR pages query DB at build time); also for `verify:db` (production only) |
| `SURREAL_USERNAME` | Both workflows (check jobs) | No | `root` |
| `SURREAL_PASSWORD` | Both workflows (check jobs) | No | SurrealDB password |
| `SURREAL_DATABASE` | Both workflows (check jobs) | No | `main` |

**Note:** `SURREAL_NAMESPACE` is intentionally not required — it's hardcoded to `"esg_hub"` in `src/lib/surrealdb.ts`.

## Secrets Access Map (per job)

### deploy.yml — check job

| Secret | Step | Reasoning |
|--------|------|-----------|
| `SURREAL_URL` | `pnpm verify:db` | DB connectivity check |
| `SURREAL_USERNAME` | `pnpm verify:db` | DB auth |
| `SURREAL_PASSWORD` | `pnpm verify:db` | DB auth |
| `SURREAL_DATABASE` | `pnpm verify:db` | DB selection |
| `SURREAL_URL` | `pnpm build` | `next build` may invoke SSR pages that query DB |
| `SURREAL_USERNAME` | `pnpm build` | Same as above |
| `SURREAL_PASSWORD` | `pnpm build` | Same as above |
| `SURREAL_DATABASE` | `pnpm build` | Same as above |

### deploy-preview.yml — check job

| Secret | Step | Reasoning |
|--------|------|-----------|
| `SURREAL_URL` | `pnpm build` | `next build` may invoke SSR pages that query DB |
| `SURREAL_USERNAME` | `pnpm build` | Same as above |
| `SURREAL_PASSWORD` | `pnpm build` | Same as above |
| `SURREAL_DATABASE` | `pnpm build` | Same as above |

Note: `verify:db` step is omitted from preview check — DB schema verification is only relevant for the production path.

### deploy.yml — deploy job

| Secret | Step | Reasoning |
|--------|------|-----------|
| `VERCEL_ORG_ID` | Trigger deploy | Required by Vercel API |
| `VERCEL_PROJECT_ID` | Trigger deploy | Identifies the project |
| `VERCEL_TOKEN` | Trigger deploy + poll | Auth for Vercel API |
| `BASE_URL` | E2E tests | Not a secret — set from step output `steps.trigger.outputs.deploy_url` |

### deploy-preview.yml — deploy-preview job

| Secret | Step | Reasoning |
|--------|------|-----------|
| `VERCEL_ORG_ID` | `vercel pull` + `vercel build` + `vercel deploy` | CLI auth via token |
| `VERCEL_PROJECT_ID` | `vercel pull` + `vercel build` + `vercel deploy` | CLI auth via token |
| `VERCEL_TOKEN` | All vercel CLI commands | Auth token |

## Vercel Project Configuration (External — managed in Vercel dashboard)

These are NOT GitHub secrets but Vercel project settings that must be pre-configured:

| Setting | Value | Notes |
|---------|-------|-------|
| Framework | Next.js | Auto-detected by Vercel |
| Build Command | `pnpm build` (override) | Vercel defaults to `next build` |
| Install Command | `pnpm install --frozen-lockfile` | Vercel detects pnpm via lockfile |
| Root Directory | `/` | Monorepo: disable if needed |
| Environment Variables | (see below) | Managed in Vercel dashboard |

### Vercel Project Environment Variables

| Variable | Environment | Notes |
|----------|------------|-------|
| `SURREAL_URL` | Production, Preview | DB connection |
| `SURREAL_USERNAME` | Production, Preview | `root` |
| `SURREAL_PASSWORD` | Production, Preview | DB password |
| `SURREAL_DATABASE` | Production, Preview | `main` |
| `NEXT_PUBLIC_BASE_URL` | Production | `https://esg-hub.ascent.partners` |

## Constraints

- No secret may appear in plain text in any workflow YAML file (enforced by AC-8)
- All secrets use `${{ secrets.NAME }}` syntax (GitHub Actions auto-masks in logs)
- `BASE_URL` for E2E is derived from Vercel deploy response, not stored as a secret
- Vercel project env vars must match the names used by `next build` and `src/lib/surrealdb.ts`

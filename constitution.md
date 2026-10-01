# Project Constitution — ESG Hub

Version: 1.0.0
Last updated: 2026-07-19

## Architecture Principles

- Server Components by default; `"use client"` only when hooks, event handlers, or browser APIs are required
- All DB access via `queryHttp()` / `queryHttpAll()` in `src/lib/surrealdb.ts` — JSON-RPC over HTTP, never WebSocket
- `SURREAL_NAMESPACE` is hardcoded to `"esg_hub"` in app code — the env var is intentionally ignored to prevent cross-project shadowing
- `output: "standalone"` in `next.config.mjs` — production builds for Vercel must use this mode
- App Router only for new pages; the legacy `src/pages/_error.js` is the sole Pages Router file

## Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | TypeScript 5.x | Strict mode, no `any` |
| Runtime | Node.js 20+ | Engine constraint: `>=18.0.0 <24.0.0` |
| Framework | Next.js 15 (App Router) | `output: "standalone"` |
| Package Manager | pnpm | Never npm or yarn |
| Database | SurrealDB Cloud | JSON-RPC over HTTP, namespace `esg_hub` |
| Styling | Tailwind CSS v4 | `@import "tailwindcss"` in globals.css, no config file |
| i18n | next-intl | Locales: en, zh, hi; default: en |
| Testing | Vitest (unit) + Playwright (E2E) | E2E in `e2e/`, unit in `src/lib/__tests__/` |
| Deployment | Vercel | Triggered via API from GitHub Actions CI |
| CI/CD | GitHub Actions | Workflows in `.github/workflows/` |

## Security Constraints

- All SurrealDB query inputs must pass through `sanitize()` or `sanitizeInt()` before interpolation
- All query parameters validated with `isAlphanumericDash()` for section/pillar names
- Never read `.env*` files — they are gitignored; all secrets at shell level or GitHub secrets
- Never hardcode secrets; never log tokens, passwords, or PII
- API routes require explicit `export const runtime = "nodejs"` and CORS OPTIONS handler

## Naming Conventions

- Components: PascalCase (`Header.tsx`)
- Hooks/utils: camelCase (`useSearch`, `surrealdb.ts`)
- Constants: UPPER_SNAKE_CASE
- Types: `type` for unions/primitives, `interface` for objects
- Path alias: `@/*` → `./src/*`

## Banned Patterns

- No `npm` or `yarn` in project directories — use `pnpm`
- No raw string interpolation in SurrealQL queries
- No new Pages Router files — use App Router
- No WebSocket connection to SurrealDB — use JSON-RPC HTTP
- No reading `.env`, `.env.local`, or `.env.production` files
- No hardcoding `SURREAL_NAMESPACE` from env var in app code (already hardcoded to `"esg_hub"`)

## Completion & Delivery Contract (MANDATORY — no agent may stop with work unfinished)

An agent is FORBIDDEN from ending a turn/session while any started work is unfinished. A task is done only when it is **all eight**: implemented → CS-verified (`cs run`) → committed → pushed → PR with evidence → CI green → **merged to `main`** → **deployed to production** → **production E2E/smoke passed**. The completing agent merges its own PR (squash) and then verifies the production deploy and E2E.

Prohibited stopping points: uncommitted/unpushed code; an open PR awaiting a human; implemented-but-unverified; CI-green-but-not-deployed; a TODO with in-progress items. Work that cannot be finished must not be started — decompose and start only completable units.

The ONLY permitted stop is a genuine hard blocker (user-only secret/decision) after exhausting the self-sufficiency ladder and shipping all completable work, with a tracking issue and the exact unblocking action recorded. "Large scope" or "context budget" are not blockers. An agent that stops with unfinished, non-blocked work has failed the task.

## File Structure Rules

```
src/
  app/          # Next.js App Router (routes, layouts, API)
  ├── [locale]/ # i18n-scoped pages
  ├── api/      # REST API routes
  components/   # Shared UI components
  lib/          # Business logic (surrealdb, markdown, search, etc.)
  data/         # Static data (sections list)
  i18n/         # next-intl routing config
  pages/        # LEGACY — do not add new files here
e2e/            # Playwright E2E tests
scripts/        # DB migrations, content tools, schema verification
messages/       # Translation files (en.json, zh.json, hi.json)
```

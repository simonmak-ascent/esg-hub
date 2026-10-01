# Plan — ESG Hub KM Transformation, Phase 1

Status: Approved (Gate 2 — 2026-07-24)
Version: 0.1
Last updated: 2026-07-24

## Execution Order

```
WS-A (schema)
  ├──► A-3, A-4 (backfill — runs after schema + vocab, independent of pipeline)
  ├──► WS-B (search + write endpoints)
  │      ├──► WS-C (MCP v1.2.0)
  │      │      └──► WS-D (skills)
  │      └──► WS-E (pipeline, depends on schema + endpoints)
  │             ├── ingestion pipeline
  │             └── R&D loop
```

WS-A through WS-E can be built in dependency order. Within WS-E, ingestion and R&D loop are independent.

---

## Task Breakdown

### A-1: Define KM schema (SurrealQL migration)

**Files:**
- `scripts/setup-km-schema.mjs` (new) — idempotent schema migration script
- `scripts/verify-db-schema.mjs` (modify) — add KM table/index/edge checks

**Schema to create:** 7 tables (`term`, `framework`, `industry`, `entity`, `source`, `scrape_job`, `content_enhancement_log`) + 5 RELATION types (`related_to`, `defines`, `cites`, `regulates`, `applies_to`) per WS-A SurrealQL definitions. 2 database events (`evt_maintain_proposals`, `evt_sync_last_verified`). 4 database functions (`fn::authority_score`, `fn::evidence_quality`, `fn::claim_confidence`, `fn::freshness_decay`). HNSW 384d indexes on `term.embedding`, `framework.embedding`, `industry.embedding`, `entity.embedding`. FULLTEXT indexes on `term.definition`, `term.name`, `framework.description`, `framework.name`. `DEFINE FIELD IF NOT EXISTS last_verified ON page TYPE option<datetime>` (additive column per AP-1).

**Script behavior:** `DEFINE TABLE IF NOT EXISTS` and `DEFINE INDEX IF NOT EXISTS` — safe to re-run. Output: summary of created/already-exists items.

**ACs:** AC-A1, structural part of AC-A2 (facets field + vocabulary assertions)

**Depends on:** nothing (first task)

---

### A-2: Seed controlled vocabularies + source table

**Files:**
- `scripts/seed-km-vocab.mjs` (new) — inserts facet vocabulary enum values into SurrealDB field assertions
- `scripts/seed-km-sources.mjs` (new) — backfills source table from `external_resource` domain list + 5 API sources

**Seed data:**
- **Facets:** 12 topics, 8 industries, 16 frameworks, 9 jurisdictions, 6 stakeholders, 6 content_types per spec AP-5
- **Sources:** 46 domains from `external_resource` → upsert into `source` table. 5 API sources (OpenAlex, OECD SDMX, UN SDG, EUR-Lex, Open-Meteo). Assign `institution_weight`, `publisher_reputation`, `recency_bonus` manually.

**ACs:** AC-A2 (vocabulary assertions populated)

**Depends on:** A-1 (tables must exist)

---

### A-3: Backfill 33 standards pages → framework records

**Files:**
- `scripts/backfill-standards.mjs` (new) — one-time migration

**Behavior:** for each page in the `standards` section, create a `framework` record with the page's title, description, permalink, and facets. Create `defines` RELATION edges to terms mentioned in the page content (keyword extraction heuristic — Phase 2 replaces with LLM extraction). Verify with: `SELECT *, ->defines->term FROM framework` returns non-empty traversals.

**ACs:** AC-A3

**Depends on:** A-1 + A-2 (tables + source data exist)

---

### A-4: Migrate related_pages arrays → related_to edges

**Files:**
- `scripts/migrate-crossrefs-to-edges.mjs` (new) — one-time migration

**Behavior:** for each page with a `related_pages` array, iterate over the array and `RELATE page:xxx->related_to->page:yyy SET relationship_type = 'cross_reference', score = 0.5`. UNIQUE index on `(in, out)` prevents duplicates. Arrays remain on `page` records (AP-1). Dry-run first, show counts.

**ACs:** structural AC-A1 (relation edges exist and are populated)

**Depends on:** A-1 (RELATION tables exist)

---

### B-1: Hybrid search endpoint (mode=hybrid)

**Files:**
- `src/app/api/v1/search/route.ts` (modify) — add `mode` query parameter handling
- `src/lib/search/hybrid.ts` (new) — Stage 1 RRF fusion + Stage 2 percentile re-rank
- `src/lib/search/types.ts` (new) — shared search types

**Implementation:**
1. Parse `mode=hybrid` from query params. If `keyword` (default), existing path unchanged.
2. Stage 1: `queryHttpAll()` runs BM25 + HNSW in one round-trip. Build `search::rrf(k=60)` from merged rank lists.
3. Stage 2: percentile-rank `text` (RRF), `framework_match` (Jaccard, only when query has framework tokens), `topic_match` (cosine similarity reused from HNSW). Authority and freshness from source table / decay function. Weight 0.40/0.20/0.15/0.15/0.10.
4. Response: `{ results, pagination, mode: "hybrid" }` — backwards-compatible shape.

**SurrealQL**: requires adding HNSW indexes to framework/industry/entity tables (done in A-1). BM25 uses existing `esg_analyzer` on `page` + new FTS indexes from A-1.

**ACs:** AC-B1

**Depends on:** A-1 (indexes must exist), A-2 (source table populated for authority scores)

---

### B-2: Write REST endpoints

**Files:**
- `src/app/api/v1/terms/route.ts` (new) — `POST` + `GET` + `OPTIONS`
- `src/app/api/v1/frameworks/route.ts` (new) — `GET` (+ `OPTIONS`, same ISR pattern as /terms)
- `src/app/api/v1/pages/[id]/facets/route.ts` (new) — `PATCH` + `OPTIONS`
- `src/lib/auth/write-token.ts` (new) — Bearer token validation
- `src/lib/middleware/rate-limit.ts` (new) — lru-cache rate limiter

**POST /api/v1/terms:** validate input against term schema → check `Authorization: Bearer <ESG_HUB_WRITE_TOKEN>` → insert into `content_enhancement_log` (status: pending) → return `{ proposal_id, status: "pending" }`.

**GET /api/v1/terms:** list terms with `limit`, `offset`, `q` params. Use `export const dynamic = 'force-static'` + `export const revalidate = 3600` (ISR, 1-hour TTL). On approval, pipeline calls `revalidatePath('/api/v1/terms')` (Next.js 15 path-based revalidation).

**PATCH /api/v1/pages/[id]/facets:** validate facet values against controlled vocabulary → check write token → update `page.facets` → return updated record.

**Rate limiter:** `lru-cache` instance, 50 req/5min per IP. Applied to POST + PATCH only.

**GET /api/v1/frameworks** (lightweight, share route style with /terms): list frameworks. Same ISR pattern.

**ACs:** AC-C2 (endpoints exist for MCP write tools to call)

**Depends on:** A-1 (content_enhancement_log and page tables exist)

---

### B-3: RAG integration (AI search → hybrid)

**Files:**
- `src/app/api/ai-search/route.ts` (modify) — replace hand-rolled BM25+vector merge with `mode=hybrid` call
- Optionally: `src/lib/ai-search/retrieval.ts` (modify) — if retrieval logic is extracted

**Behavior:** the RAG retrieval step calls `/api/v1/search?mode=hybrid&q=...` internally (or imports `hybrid.ts` directly) instead of the current `mergeAndRank(bm25, vector)` function. Same response → same LLM prompt construction. No user-facing change.

**ACs:** AC-B2

**Depends on:** B-1 (hybrid search must work)

---

### B-4: Search evaluation benchmark

**Files:**
- `scripts/eval-search.mjs` (new) — runs 30 hand-labeled queries, computes nDCG@10 + MRR

**30 queries:** mix of practitioner workflows (framework lookup, definition search, regulation search, comparison intent). Labels: top-10 results per query marked relevant/not-relevant by human. Assertion: `nDCG@10 ≥ 0.6`, `MRR ≥ 0.5`. Run in CI (`pnpm run eval-search`), non-blocking initially, promoted to `ci.yml` check after Phase 1 stabilization.

**ACs:** AC-B1 (benchmark gate)

**Depends on:** B-1 + A-3 (hybrid search + backfill data must exist for meaningful queries)

---

### C-1: MCP server — read tools

**Files:**
- `mcp-server/src/index.ts` (modify) — add new tool registrations
- `mcp-server/package.json` (modify) — bump version to 1.2.0

**New tools (all readOnlyHint: true):**
| Tool | Endpoint called | Input | Output |
|------|----------------|-------|--------|
| `search_content` | `GET /api/v1/search?mode=hybrid&q=&limit=` | query, limit | `{ items, pagination }` + structuredContent |
| `get_term` | `GET /api/v1/terms?id=` | term_id | `{ term, related: [...], backlinks: [...] }` via graph traversal |
| `get_related` | assembles from REST | record_id, edge_type? | `{ edges: { [edge_type]: [...] } }` via `/api/v1/pages/:id/related` + `/api/v1/terms` |
| `list_frameworks` | new `GET /api/v1/frameworks` | limit, offset | `{ items, pagination }` |
| `list_industries` | new inline or framework list | limit, offset | `{ items, pagination }` |

`get_related`: since we need graph traversal but the REST API doesn't have a direct graph-traverse endpoint yet, the tool makes two calls: existing `/api/v1/pages/:id/related` (reads from arrays, backward compat) + new `GET /api/v1/terms` filtered by framework ID for `defines` edges. Phase 3 replaces with a single `GET /api/v1/related/:id` endpoint that does native graph traversal.

`get_term`: calls `GET /api/v1/terms?id=...` then separately queries SurrealDB graph via the REST API for related frameworks. Returns structured output: `{ term, related: [{ id, name, edge_metadata }] }`.

**ACs:** AC-C1, AC-C3 (v1.1.0 tools unchanged)

**Depends on:** B-1 + B-2 (search + write endpoints must work)

---

### C-2: MCP server — write tools

**Files:**
- `mcp-server/src/index.ts` (modify) — add tool registrations
- `mcp-server/.env.example` (add) — `ESG_HUB_API_BASE`, `ESG_HUB_WRITE_TOKEN`

**New tools:**
| Tool | REST call | Annotations |
|------|-----------|-------------|
| `propose_term` | `POST /api/v1/terms` with `Authorization: Bearer <ESG_HUB_WRITE_TOKEN>` | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false` |
| `tag_content` | `PATCH /api/v1/pages/:id/facets` with same auth | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false` |

**Token flow:** the MCP server reads `ESG_HUB_WRITE_TOKEN` from its own process environment (set by opencode config). This is a **server-owned upstream service credential**, not an MCP client token — the MCP specification (2025-11-25) prohibits passing through client tokens but explicitly supports server-owned upstream tokens for service-to-service calls. The token is forwarded as `Authorization: Bearer <token>` to the REST endpoints. Validation and authorization happen at the REST layer. No client authentication reaches or leaves the MCP server — the token is scoped exclusively to the write REST endpoints and never exposed to MCP clients.

**Error handling:** structured error envelope (same pattern as v1.1.0). 401 → "Write token missing or invalid". 429 → "Rate limit exceeded, retry in N seconds". 400 → "Validation failed: field X must be Y".

**ACs:** AC-C2, AC-C3

**Depends on:** B-2 (write endpoints must work), C-1 (read tools provide the reference patterns)

---

### D-1: Agent skills

**Files:**
- `.opencode/skills/esg-taxonomy-tagging/SKILL.md` (new)
- `.opencode/skills/esg-relevance-ranking/SKILL.md` (new)
- `.opencode/skills/esg-glossary-writer/SKILL.md` (new)
- `.opencode/skills/esg-source-authority-review/SKILL.md` (new)
- `AGENTS.md` (modify) — add skills section referencing the 4 skills

**Each SKILL.md must include:**
1. `name:` matching directory name
2. `description:` one-liner of what the skill does
3. Purpose: what problem it solves
4. Trigger: when to activate (keywords + context)
5. Required MCP tools: list with usage guidance per tool
6. I/O schema: JSON Schema for input params and output shape
7. One worked example: real ESG Hub data (e.g., "classify this page: `get_esg_page('climate-change')`")

**Worked examples — data sources:**
- `esg-taxonomy-tagging`: classify `page:environmental/climate-change` → facets json
- `esg-relevance-ranking`: rank search results for "scope 3 emissions" → re-ranked results
- `esg-glossary-writer`: draft a term definition for "double materiality" from existing KB pages
- `esg-source-authority-review`: score source authority for `globalreporting.org`

**AGENTS.md update:** add `## Agent Skills` section listing the 4 skills with one-line descriptions and the skill tool invocation pattern.

**ACs:** AC-D1, AC-D2

**Depends on:** C-1 (MCP read tools must be available for skills to reference)

---

### E-1: Ingestion pipeline script

**Files:**
- `scripts/km-ingestion.mjs` (new) — main pipeline driver
- `.github/workflows/km-ingestion.yml` (new) — cron workflow
- `scripts/lib/pipeline-fetcher.mjs` (new) — HTTP fetch with retries, rate limits, dedup
- `scripts/lib/pipeline-normalizer.mjs` (new) — HTML→text via cheerio + Mozilla Readability + Playwright fallback
- `scripts/lib/pipeline-llm.mjs` (new) — DeepSeek extract/verify calls with prompt templates
- `scripts/lib/pipeline-embedder.mjs` (new) — fastembed-js embedding generation

**Script logic** (per WS-E design):
1. `ACQUIRE`: Defense-in-depth overlap prevention:
   - **Primary:** GitHub Actions `concurrency: { group: "km-ingestion", cancel-in-progress: false }` — GH natively serializes runs in the same group.
    - **Secondary:** SurrealDB lease with fencing token: `CREATE lease:km_ingestion SET owner_id = $GITHUB_RUN_ID, fencing_token = rand::uuid(), expires_at = time::now() + 4h`. Creation fails atomically if the record ID already exists. On failure, atomic conditional takeover: `UPDATE ... SET owner_id = $NEW_ID, fencing_token = ... WHERE expires_at < time::now()`. All protected writes include fencing_token in WHERE clause. Heartbeat: `UPDATE ... SET expires_at = ... WHERE owner_id = $RUN_ID AND fencing_token = $TOKEN`. Cleanup: `DELETE ... WHERE owner_id = $RUN_ID`.
   - **Heartbeat:** renew `expires_at` every 30 min. On timeout/cleanup: `DELETE lease:km_ingestion`.
2. `ENQUEUE`: load source list from `source` table where `is_active = true AND fetch_schedule matches current slot`
3. `FETCH`: for each queued job — HTTP fetch with retries + rate limits. HTML sources: cheerio for static pages, Mozilla Readability for main-content extraction (removes navigation, cookie banners, boilerplate; production library used by Firefox Reader View). JSON/XML sources: parsed directly. If a page requires JavaScript rendering, fall back to Playwright (opt-in per source; most source pages are static regulatory/standards texts).
4. `LLM_PIPELINE`:
   - EXTRACT: DeepSeek-chat, structured JSON, schema-validated, retry once on malformed
   - NORMALIZE: canonical name resolution, date normalization, **deterministic pre-verification** (source_span string match after Unicode NFC normalization + whitespace normalization — catches encoding/whitespace variations that would break exact matching))
   - VERIFY: DeepSeek-reasoner, only if confidence < 0.8 or novel entity. Log confidence + outcome for calibration.
   - PROPOSE: `POST /api/v1/terms` (glossary) + direct SurrealDB insert (external_resource, scrape_job updates). `fastembed-js` generates 384d vector.
5. `REPORT`: update `scrape_job.completed_at`, log proposal count

**Cron workflow:** schedule `17 6,18 * * *` (odd-minute, avoids hour-start congestion). `workflow_dispatch` fallback. Timeout-minutes: 240. Concurrency: `cancel-in-progress: false` (one run at a time, queue subsequent). Secrets: `SURREAL_URL`, `SURREAL_USERNAME`, `SURREAL_PASSWORD`, `SURREAL_DATABASE`, `DEEPSEEK_API_KEY`, `ESG_HUB_WRITE_TOKEN`.

**LLM configuration:**
- Model: `deepseek-chat` for extract, `deepseek-reasoner` for verify
- Temperature: 0.1 for extract (deterministic structured output — lower values produce more focused generations per OpenAI guidance). 0.1 for verify (contradiction detection is analytical, not creative — lower temperature reduces variance; false positives are worse than false negatives). Temperature values selected from labeled evaluation sets, regression-tested on pipeline changes.
- **Document chunking:** ESG documents (regulations, standards) can exceed 50K tokens. The pipeline splits by structural boundaries (article/section numbers in regulations; heading hierarchy in standards) into ~512-token chunks with 25% overlap. Each chunk is extracted independently; results are hierarchically aggregated with cross-section consistency checks in the NORMALIZE step.
- Token budget: 4K input + 2K output per extract chunk, 8K input + 4K output per verify chunk. Documents with no clear structural boundaries fall back to semantic splitting.
- Retry: 1 retry on rate-limit (429) with 30s backoff, 1 retry on malformed JSON, skip on other errors
- Prompt: system prompt includes controlled vocabulary enum values for in-prompt validation

**ACs:** AC-E1, AC-E4, AC-E5

**Depends on:** A-1 (tables), A-2 (source list), B-2 (POST /api/v1/terms endpoint)

---

### E-2: R&D loop script

**Files:**
- `scripts/km-rd-loop.mjs` (new) — daily page verification driver
- `.github/workflows/km-rd-loop.yml` (new) — cron workflow

**Script logic** (per WS-E design):
1. `ACQUIRE`: Defense-in-depth (same pattern as ingestion — GH concurrency + DB lease). Timeout: 2 hours.
2. `SELECT`: query pages by `last_verified IS NULL OR last_verified < threshold`, stratified by content type (standards: 30 days, other: 60 days). Pick oldest first, N = ceil(total_pages / target_cycle_days).
3. `VERIFY` per page:
   a. Link freshness: HEAD + GET fallback on 405/501. Soft-404 hash comparison.
   b. Claim re-check: extract 2-3 key claims → Perplexity MCP (perplexity_ask) → verdict assignment.
   c. Cross-reference: check `related_to`, `defines`, `cites` edges for bidirectionality and orphan targets.
   d. Claim tracking: write `content_enhancement_log` with `target_table = "claim"`, storing verdict + evidence snapshot.
4. `PROPOSE`: `POST /api/v1/terms` for link fixes, `PATCH /api/v1/pages/:id/facets` for facet/cross-ref fixes.

**Cron workflow:** schedule `13 4 * * *` (odd-minute, off-peak). Timeout-minutes: 120. Same concurrency and secrets pattern as ingestion.

**Perplexity MCP integration:** the R&D loop script runs in GH Actions and cannot directly call MCP tools (MCP is an interactive protocol). Instead, the script calls `POST https://api.perplexity.ai/v1/agent` with `preset: "medium"` directly (the same API the Perplexity MCP wraps). Query: "Verify this claim against authoritative sources: [claim text]. Source page: [url]. Return: supported|refuted|conflicting|insufficient_evidence with citations."

**ACs:** AC-E2, AC-E4, AC-E5

**Depends on:** A-1 (last_verified field on page), A-4 (related_to edges exist), B-2 (write endpoints)

---

### E-3: Review approval script

**Files:**
- `scripts/review-enhancements.mjs` (new) — human gate CLI

**Commands:**
```
node scripts/review-enhancements.mjs --list [--status pending]
  → table of proposals: proposal_id, job_id, target_table, target_id, diff_summary, created_at

node scripts/review-enhancements.mjs --show <proposal_id>
  → full diff, source URLs, authority score, pre-verification status

node scripts/review-enhancements.mjs --approve <proposal_id>
  → applies diff to target record (via REST PATCH or direct SurrealDB UPDATE)
  → updates content_enhancement_log.status = "approved", reviewer = $USER, reviewed_at = now()
  → triggers revalidatePath('/api/v1/terms') if target_table is "term" or "framework"
  → confirms: "Proposal <id> approved. Updated term:ghg. Cache invalidated."

node scripts/review-enhancements.mjs --reject <proposal_id> --note "Not a standard definition"
  → updates content_enhancement_log.status = "rejected", review_notes = note
  → confirms: "Proposal <id> rejected."
```

**Safety:** dry-run by default for approve (shows diff, asks `[y/N]`). `--force` skips prompt. Rejects are immediate (no content change).

**ACs:** AC-E3

**Depends on:** E-1 + E-2 (proposals must exist), B-2 (PATCH endpoints for applying diffs)

---

### E-4: Pipeline evaluation script

**Files:**
- `scripts/eval-pipeline.mjs` (new) — CI-gated calibration check

**Behavior:** loads all `content_enhancement_log` entries where `status = "approved"` or `"rejected"`. Groups by `job_id` to find extractor confidence scores paired with human review outcomes. Computes Expected Calibration Error (ECE) + field-level precision/recall/F1 + approval rate over rolling 30-day windows, sliced by source type, model version, and extraction field. ECE is a calibration signal (not an extraction-quality metric by itself — a low-accuracy model can be perfectly calibrated). Alerts if ECE > 0.15 OR any field-level F1 drops below baseline by >0.05. Run as part of `nightly.yml`, non-blocking initially.

**ACs:** AC-E5 (auditability + calibration tracking)

**Depends on:** E-3 (approval/rejection data must exist)

---

### Integration task: CI wiring

**Files:**
- `.github/workflows/ci.yml` (modify) — add `eval-search` job (non-blocking), add `verify:db` for KM tables
- `.github/workflows/nightly.yml` (modify) — add `eval-pipeline` job
- `package.json` (modify) — add scripts: `eval-search`, `seed-km`, `backfill-km`, `review-enhancements`

**Depends on:** all tasks complete

---

## Test Strategy

### Unit tests (Vitest, `src/lib/__tests__/`)
| Test file | What it covers |
|-----------|---------------|
| `hybrid.test.ts` | Stage 1 RRF fusion with known ranks, Stage 2 percentile ranking with known inputs, weight redistribution when features missing |
| `rate-limit.test.ts` | lru-cache rate limiter: within-limit passes, over-limit returns 429, reset after window |
| `write-token.test.ts` | valid token → passes, missing token → 401, invalid token → 401 |

### Schema verification (CI, `pnpm verify:db`)
Extend existing `verify-db-schema.mjs` to check:
- All 7 KM tables exist
- All 5 RELATION types exist with FROM/TO constraints
- All indexes (FULLTEXT + HNSW + UNIQUE) exist
- `page.last_verified` field exists (DEFINE FIELD IF NOT EXISTS)

### Search evaluation (`pnpm eval-search`, CI non-blocking)
- 30 hand-labeled queries → nDCG@10 ≥ 0.6, MRR ≥ 0.5

### Pipeline integration test (automated CI + manual live)
- **Automated (CI, every PR):** fixture-based tests using pre-recorded HTML/JSON responses for 3 representative source types (regulation, standard, academic paper). Validates: schema output shape, source_span existence, entity typing, taxonomy tag membership. No live LLM calls — uses recorded responses.
- **Manual (workflow_dispatch):** live end-to-end run on 1-2 real sources. Verifies LLM quality drift + link verification. Used before deployment and for diagnostics.

### MCP tool test (manual, via opencode)
- `search_content "scope 3 emissions"` → returns hybrid-ranked results
- `get_term "ghg-protocol"` → returns term + related frameworks
- `propose_term` with invalid token → returns 401
- `propose_term` with valid token → returns proposal ID

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| GH Actions cron skip/delay under load | Medium | Low (batch not time-critical) | DB lease lock prevents overlap; workflow_dispatch fallback; odd-minute cron |
| fastembed-js produces incompatible vectors vs browser Transformers.js | Low (same model) | High (search breaks) | Golden vector gate: cosine >0.999 + top-10 overlap >95% + labeled nDCG@10 within 0.02 across both implementations on a 100-page sample; atomic index switch if re-embed needed |
| DeepSeek structured output malformed despite schema prompt | Medium | Medium (lost extraction) | Schema validation + 1 retry; failed extractions logged to scrape_job for review |
| Perplexity MCP unavailable during R&D claim checks | Low | Low (1 run skipped) | Claim checks are best-effort; run skips with warning, other checks continue |
| Pipeline writes to SurrealDB fail mid-batch | Low | Medium (partial state) | Idempotent design: re-run picks up from last scrape_job checkpoint; RELATE UNIQUE indexes prevent duplicates |
| 354 pages → 6/day = 60 days, but pipeline adds new pages | Medium | Low (cycle lengthens) | Stratified scheduling: standards every 30 days, new pages prioritized; Phase 2 adds claim-level targeting |
| DB lease lock not released on timeout/error | Low | Medium (pipeline blocked) | Auto-detection: next run checks `expires_at < now`, atomically takes over. Manual `scripts/release-km-lock.mjs` is break-glass only — deletes only if owner matches and lease is expired or explicitly `--force`'d, audit-logged every use. |

| GH Actions `cancel-in-progress: false` only buffers 1 pending run | Low | Low (2x daily, runs <4h) | 12-hour gap between runs; if a run exceeds 4h, the next fires 8h later. Worst case: 2 runs queue → older pending replaced. Acceptable for best-effort batch. Alert if run duration exceeds 3h. |

---

## File Manifest (what changes)

```
NEW FILES (29):
  scripts/setup-km-schema.mjs
  scripts/seed-km-vocab.mjs
  scripts/seed-km-sources.mjs
  scripts/backfill-standards.mjs
  scripts/migrate-crossrefs-to-edges.mjs
  scripts/eval-search.mjs
  scripts/eval-pipeline.mjs
  scripts/km-ingestion.mjs
  scripts/km-rd-loop.mjs
  scripts/review-enhancements.mjs
  scripts/lib/pipeline-fetcher.mjs
  scripts/lib/pipeline-normalizer.mjs
  scripts/lib/pipeline-llm.mjs
  scripts/lib/pipeline-embedder.mjs
  scripts/release-km-lock.mjs
  .github/workflows/km-ingestion.yml
  .github/workflows/km-rd-loop.yml
  src/lib/search/hybrid.ts
  src/lib/search/types.ts
  src/lib/auth/write-token.ts
  src/lib/middleware/rate-limit.ts
  src/app/api/v1/terms/route.ts
  src/app/api/v1/frameworks/route.ts
  src/app/api/v1/pages/[id]/facets/route.ts
  mcp-server/.env.example
  .opencode/skills/esg-taxonomy-tagging/SKILL.md
  .opencode/skills/esg-relevance-ranking/SKILL.md
  .opencode/skills/esg-glossary-writer/SKILL.md
  .opencode/skills/esg-source-authority-review/SKILL.md

MODIFIED FILES (9):
  scripts/verify-db-schema.mjs          (+KM table/index checks)
  src/app/api/v1/search/route.ts        (+mode=hybrid)
  src/app/api/ai-search/route.ts        (→ use hybrid internally)
  mcp-server/src/index.ts               (+6 read tools, +2 write tools)
  mcp-server/package.json               (v1.1.0 → v1.2.0)
  .github/workflows/ci.yml              (+eval-search job)
  .github/workflows/nightly.yml         (+eval-pipeline job)
  AGENTS.md                             (+Agent Skills section)
  package.json                          (+scripts: eval-search, seed-km, etc.)
```

# Implementation Plan — Video Catalogue Integration

Status: Draft (Gate 2 pending)
Version: 1.0
Last updated: 2026-07-20
Spec: `specs/video-catalogue-integration/spec.md` · Constitution: `constitution.md`

## Architecture

Content-only feature. One reviewable script (`scripts/integrate-video-catalogue.mjs`) performs: dead-handle replacement + CSV ingest classification + URL verification + markdown generation + UPDATE of two `page` records. No app code changes. Deploy via normal merge (workflow already green).

## Dead-Link Fixes (AC-1, AC-2)

Both handles appear only in `/learning/videos/` (verified by DB query). Literal replacements:

| Dead (404) | Replacement (verified 200, 2026-07-20) |
|------------|------------------------------------------|
| `https://www.youtube.com/@TNFD_` | `https://www.youtube.com/channel/UCxr65yI_szV8UODfmyuhTzw` |
| `https://www.youtube.com/@EFRAG` | `https://www.youtube.com/channel/UCxcljiiUM2JD02SMuFUTUwA` (EFRAG's actual channel, found via a live EFRAG video's channelId) |

## Record Classification (AC-3, AC-E1)

Dedupe vs current DB content (URL + normalized title) + editorial flags, 2026-07-20:

### Integrate → `/learning/courses/` (course type, 10 records)

| Ref | Title (short) | Section |
|-----|---------------|---------|
| GRI-C-0001 | Reporting with the GRI Standards | Sustainability Reporting & Disclosure |
| GRI-C-0002 | Navigating the GRI Sector Standards | Sustainability Reporting & Disclosure |
| GRI-C-0003 | Transparency for Tomorrow | Sustainability Reporting & Disclosure |
| ILO-C-0001 | ESG Leadership Essentials | General ESG & Sustainability |
| OECD-C-0001 | Essentials of Due Diligence for RBC | General ESG & Sustainability |
| OECD-C-0002 | Due Diligence: Garment & Footwear | General ESG & Sustainability |
| OECD-C-0003 | Due Diligence: Agriculture & Food | General ESG & Sustainability |
| OSCE-C-0001 | Good Governance & Anti-Corruption | General ESG & Sustainability |
| TI-C-0001 | Preventing Corruption in Humanitarian Aid | General ESG & Sustainability |
| TI-C-0002 | Corruption, Data and the SDGs | General ESG & Sustainability |

### Integrate → `/learning/videos/` (video/webinar/series/talk, 9 records)

| Ref | Title (short) | Section | Notes |
|-----|---------------|---------|-------|
| BURSA-VS-0001 | Bursa Sustainability Explainer Series | Reporting Standards & Frameworks | series link |
| HKGFA-CT-0001 | HKGFA Annual Forum: Transition Plans | Investment & Finance | YouTube |
| HKGFA-W-0001 | Sectoral Webinar on Green Finance | Investment & Finance | |
| HKGFA-W-0002 | Transition Planning Webinar #3 | Investment & Finance | youtu.be |
| JPX-V-0001 | Post-ISSB ESG Disclosure Framework | Reporting Standards & Frameworks | video-embed, **(Japanese)** |
| JPX-V-0002 | GPIF Engagement Verification | Investment & Finance | video-embed, **(Japanese)** |
| JPX-VS-0001 | JPX ESG Knowledge Hub Seminars | Reporting Standards & Frameworks | **(Japanese)** |
| TNFD-W-0001 | TNFD 101 Introduction | Climate & Environment | |
| WB-W-0001 | CBIN Financial Sustainability | Investment & Finance | |

### Excluded (6)

| Ref | Reason |
|-----|--------|
| TNFD-C-0001 | URL duplicate — "TNFD Learning Lab" already on `/learning/courses/` (+ NEEDS REVIEW flag) |
| UNGC-W-0002 | URL duplicate — already in DB content |
| UNCC-C-0008 | Title match — "Introduction to Sustainable Finance (Taxonomies)" already listed (UN CC:e-Learn) |
| GRI-C-0004 | NEEDS REVIEW flag (AC-E1) |
| GRI-C-0005 | NEEDS REVIEW flag (AC-E1) |
| ISCA-C-0001 | NEEDS REVIEW flag (AC-E1) |

## Script Design (`scripts/integrate-video-catalogue.mjs`)

Flags: `--dry-run` (default), `--apply`.

1. Parse CSV (path constant `./esg_video_catalogue_v6_superset.csv`, overridable via `--csv`); filter `status=active`
2. Fetch current content of `/learning/courses/` + `/learning/videos/` via `/sql` endpoint using `scripts/lib/db-env.mjs`
3. Recompute dedupe at runtime (URL + normalized title); apply NEEDS-REVIEW exclusion; print classification table
4. Verify every target URL: GET with browser UA, accept 200; accept 403/415 with a note; abort that record otherwise (never write unverified links)
5. Generate markdown:
   - Courses: `| [Title](URL) | Provider | Duration | Focus |` rows appended at the END of the matching section's table (before the section's closing `---`)
   - Videos: entries in the page's existing style (bold title + linked description line) under the matching `##` section; YouTube single videos use `{% include video-embed.html provider="youtube" id="..." title="..." caption="..." %}`
   - Japanese records get `(Japanese)` after the title (AC-E2)
6. Apply dead-handle replacements (literal, count occurrences, report)
7. `--dry-run`: print unified diff of both pages, no writes. `--apply`: dump pre-mutation content to `specs/video-catalogue-integration/backup-<ts>.md`, run two `UPDATE page SET content = ... WHERE permalink = ...` statements, re-fetch and re-verify (grep zero dead handles; entries present), write integration report to `specs/video-catalogue-integration/integration-report.md`
8. Idempotency: entries detected as already-present are skipped → re-run after success is a no-op (AC-8)

## Duration/Focus mapping (courses table)

- Duration: from `durationminutes` (e.g., `210 min` → "3.5 hours") or "Self-paced" when absent
- Focus: first phrase of `description` (truncated ~60 chars) or `topictags` first tag
- Provider: `sourceorganization`

## Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Section table end detection breaks on markdown edge cases | anchor on the literal `---` separator after each section's table; dry-run diff reviewed by human before `--apply` |
| R2 | URL checks flaky (bot protection) | browser UA + 403/415 accept-with-note; abort-on-other-errors prevents bad writes |
| R3 | JPX video IDs wrong format for embed | extract `v=` param strictly; skip with report if absent |
| R4 | Double-append on re-run | presence check before append + idempotency verified by running script twice in dry-run |

## Tasks (preview for tasks.md)

T-01 write script + dry-run review (human gate on diff) → T-02 `--apply` (mutation, confirmation) → T-03 verify DB state (AC-1/2/6) → T-04 integration report + backup committed → T-05 merge → post-deploy lychee sweep of both pages (AC-9).

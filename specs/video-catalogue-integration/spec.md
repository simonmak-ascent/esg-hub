# Video Catalogue Integration — Dead Link Cleanup + v6 Superset Ingest

Status: Approved (Gate 1 passed)
Version: 1.0
Last updated: 2026-07-20

## Overview

Clean up verified-dead YouTube links in DB page content, review the curated v6 video catalogue (`esg_video_catalogue_v6_superset.csv`), and integrate its 25 active records into the ESG Hub's learning pages (`/learning/courses/`, `/learning/videos/`) following existing content formats.

## Research Summary (2026-07-20)

**CSV** (provided out-of-band as `esg_video_catalogue_v6_superset.csv`): 86 rows × 64 cols.
- **61 `delisted`** — editorial notes mark all as duplicates of earlier "v2" records ("Do NOT re-ingest") → excluded
- **25 `active`** — GRI Academy ×5, JPX ×3 (2 Japanese), HKGFA ×3, OECD ×3, TI ×2, TNFD ×2, and 1 each from BURSA, ILO, ISCA, OSCE, UNCC, UNGC, WB
- Types: course ×15, webinar ×4, video ×2, videoseries ×2, conferencetalk ×1, plus 1 other
- Hosts: mostly publisher platforms (GRI, OECD, TNFD…); 4–5 YouTube URLs
- 9 records carry `NEEDS REVIEW` editorial flags; 34 carry `VERIFIED` flags
- `TNFD Learning Lab` already exists on `/learning/courses/` → dedupe required against current DB content, not just the CSV

**Dead links** (from lychee sweep, issue #8):
- `youtube.com/@EFRAG` → 404 (linked in `/learning/videos/`); handle dead, videos exist individually — replacement must be a verified-200 URL at implementation
- `youtube.com/@TNFD_` → 404; official channel verified alive at `https://www.youtube.com/channel/UCxr65yI_szV8UODfmyuhTzw` (200)
- Bot-blocked (403/415) links are NOT dead → untouched

**Surfaces:** `/learning/courses/` = markdown tables (Course | Provider | Duration | Focus) by topic section. `/learning/videos/` = curated markdown sections with channel links and `{% include video-embed.html %}` blocks. `resource` table is empty — integration targets page **content**, not a new table.

## User Stories

- As a **visitor**, I want video/course links on the Hub to work so that I don't hit 404s.
- As a **content maintainer**, I want the v6 catalogue's active records integrated in the existing page formats without duplicating what's already published.
- As a **content maintainer**, I want a reviewable dry-run before any DB content mutation.

## Boundaries

**Always do:**
- Verify every replacement/integrated URL returns 200 (or accepted bot-block 403/415) before writing
- Dedupe against current DB page content (URL and normalized title) before appending
- Show the full markdown diff and get confirmation before running the DB mutation
- Preserve existing markdown section structure and table formats exactly
- Keep the mutation idempotent (safe to re-run; no double-appends)

**Ask first:**
- Changing page structure/format rather than appending entries
- Translating new entries (zh/hi) — deferred by default
- Ingesting any `delisted` record or any record flagged `NEEDS REVIEW` without explicit per-record approval

**Never do:**
- Ingest `delisted`/duplicate-marked records
- Guess replacement URLs without a live 200 check
- Modify `title`, `permalink`, or any translated (`*_zh`/`*_hi`) fields
- Touch tables other than `page`

## Acceptance Criteria

- **AC-1 [MUST]** Given the dead `@TNFD_` handle, when DB page content is updated, then zero occurrences of `youtube.com/@TNFD_` remain and every former occurrence links to a URL verified 200 at write time (`https://www.youtube.com/channel/UCxr65yI_szV8UODfmyuhTzw`).
- **AC-2 [MUST]** Given the dead `@EFRAG` handle, when DB page content is updated, then zero occurrences of `youtube.com/@EFRAG` (exact handle) remain and the replacement URL(s) are verified 200 at write time.
- **AC-3 [MUST]** Each of the 25 active records is classified in `plan.md` as integrate-to-courses, integrate-to-videos, or skip-duplicate, with the dedupe match recorded; the 61 delisted records are untouched.
- **AC-4 [MUST]** Course-type records appear in `/learning/courses/` inside the correct topic section, in the existing `| [Title](url) | Provider | Duration | Focus |` format.
- **AC-5 [MUST]** Video/webinar/series/talk records appear in `/learning/videos/` inside the correct topic section, in that page's existing format; single-video YouTube records use the `video-embed` include format.
- **AC-6 [MUST]** No integrated entry duplicates an entry already present in DB content (URL or normalized-title match) — verified by re-querying content after mutation.
- **AC-7 [MUST]** Every URL written to the DB was verified live (200, or 403/415 bot-block documented) within the same run.
- **AC-8 [SHOULD]** The integration script supports `--dry-run` printing the exact diff, and re-running it after a successful apply is a no-op.
- **AC-9 [MUST]** After deploy, `/en/learning/courses` and `/en/learning/videos` render the new entries, and a lychee sweep of both pages reports no new dead links beyond the known bot-blocked set.
- **AC-E1 [MUST]** Records with `NEEDS REVIEW` notes are listed in the integration report and excluded unless individually approved.
- **AC-E2 [MUST]** Non-English records (JPX `ja` URLs) are included and visibly marked with their language (e.g., "(Japanese)") in the markdown. *(Resolved 2026-07-20: include, marked.)*

## Non-Functional Requirements

- Reversibility: pre-mutation content of both pages is dumped to `specs/video-catalogue-integration/backup-<date>.md` before any UPDATE
- Auditability: integration report (ingested/skipped/replaced, with URLs) committed to the spec folder
- No application code changes (content-only feature); deploy happens via normal merge to main

## Out of Scope

- `delisted` records and "v2" catalogue reconciliation
- zh/hi translation of new entries (existing auto-translate scripts can run later)
- Fixing bot-blocked (403/415) outbound links
- Full-site YouTube link audit beyond the two verified-dead handles and the integrated records
- A dedicated `video` DB table or changes to the videos page rendering code
- n8n notifications for this job

## Open Questions

- [RESOLVED] CSV location → supplied as an out-of-band input file
- [RESOLVED] Delisted records → excluded per their editorial notes
- [RESOLVED] TNFD replacement → official channel URL verified 200
- [OPEN] ~~JPX Japanese-language records~~ [RESOLVED 2026-07-20] → include with "(Japanese)" marker (AC-E2)

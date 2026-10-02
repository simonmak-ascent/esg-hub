# Integration Report 2026-07-19T19-51-25-142Z

## Integrated (16)
- BURSA-VS-0001 -> videos/Reporting Standards & Frameworks [bot-blocked(403)]
- GRI-C-0001 -> courses/Sustainability Reporting & Disclosure [ok]
- GRI-C-0002 -> courses/Sustainability Reporting & Disclosure [ok]
- GRI-C-0003 -> courses/Sustainability Reporting & Disclosure [ok]
- HKGFA-CT-0001 -> videos/Investment & Finance [ok]
- HKGFA-W-0001 -> videos/Investment & Finance [ok]
- HKGFA-W-0002 -> videos/Investment & Finance [ok]
- ILO-C-0001 -> courses/General ESG & Sustainability [ok]
- JPX-V-0001 -> videos/Reporting Standards & Frameworks [ok]
- JPX-V-0002 -> videos/Investment & Finance [ok]
- JPX-VS-0001 -> videos/Reporting Standards & Frameworks [ok]
- OECD-C-0001+OECD-C-0002+OECD-C-0003 -> courses/General ESG & Sustainability [bot-blocked(403)] (merged row)
- TI-C-0001 -> courses/General ESG & Sustainability [ok]
- TI-C-0002 -> courses/General ESG & Sustainability [bot-blocked(403)]
- TNFD-W-0001 -> videos/Climate & Environment [ok]
- WB-W-0001 -> videos/Investment & Finance [ok]

## Skipped (6)
- GRI-C-0004: NEEDS REVIEW flag
- GRI-C-0005: NEEDS REVIEW flag
- ISCA-C-0001: NEEDS REVIEW flag
- TNFD-C-0001: NEEDS REVIEW flag
- UNCC-C-0008: already in DB content
- UNGC-W-0002: already in DB content

## Failed URL checks (1)
- OSCE-C-0001: https://elearning.osce.org/courses/course-v1:OSCE+OCEAA-01+2023-Q4/about -> FAIL(404)

## Dead-link replacements
- https://www.youtube.com/@TNFD_ -> https://www.youtube.com/channel/UCxr65yI_szV8UODfmyuhTzw
- https://www.youtube.com/@EFRAG -> https://www.youtube.com/channel/UCxcljiiUM2JD02SMuFUTUwA

## Post-deploy corrections & verification (2026-07-20)

- **Fix:** the 2 JPX single-video entries were first written as `{% include video-embed.html %}` blocks, but `/learning/videos/` renders via the generic [...slug] markdown pipeline which shows includes as raw text (only the custom `/videos` page parses them). Converted both to the page's prose format in DB + script updated for future runs. Verified: 0 raw includes on the live page.
- **Idempotency:** second dry-run after apply = 0 lines added, 0 dead-handle occurrences (AC-8). Required a YouTube-ID dedupe check (embed→prose IDs, case-insensitive).
- **Live render:** new entries confirmed on `/en/learning/courses` and `/en/learning/videos` (AC-9).
- **Lychee sweep of both pages:** 195 links, 0 failures from integrated records. 3 pre-existing issues: `github.com/simonmak-ascent/esg-hub` (404 for anonymous — repo is private; linked from `Footer.tsx:52` on every page — needs repo-visibility decision), `unccelearn.org/course/view.php?id=139` (connection reset — pre-existing UNCC link).

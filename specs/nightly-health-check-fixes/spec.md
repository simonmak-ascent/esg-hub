# Nightly Health Check — Error Review & Issue-Management Fixes

Status: Completed (2026-07-21, PR #20)
Version: 1.0
Last updated: 2026-07-21

## Overview

Review every error surfaced by the Nightly Health Check workflow since its creation and fix what remains. The content-side findings are already resolved (verified clean); the real defects are in the workflow's issue-management logic: it posts misleading "Still failing" comments on green runs, never auto-closes when a sweep comes back clean, and provides no failure detail.

## Research Summary (2026-07-21, MCP web research + live checks)

**Content findings — all resolved:**

| Original finding | Current state |
|------------------|---------------|
| Dead YouTube channels (@EFRAG, @TNFD_ 404) | ✅ fixed via `specs/video-catalogue-integration` (official channel URLs verified 200) |
| `github.com/simonmak-ascent/esg-hub` 404 (anonymous) ×2 | ✅ fixed by repo going public (200) |
| `unccelearn.org/course/view.php?id=139` (connection reset / 403) | ✅ course confirmed alive (Brave Search result: exact URL, full description); 403 is bot-blocking — correctly in accept-list, no action |
| manuscdn session-file PDFs (403) | ✅ no longer present in any `page` content (DB query: zero rows) |

**Latest scheduled run (2026-07-20T18:57Z): lychee 🚫 Errors = 0, verify:db green, smoke green.**

**Remaining defects (workflow logic, not content):**

| # | Defect | Evidence |
|---|--------|----------|
| D1 | "Still failing: \<run URL\>" comments fire on **successful** runs whenever lychee has findings — message wrongly implies run failure | issue #8: comments on runs 29693468529 + 29699020030, both `success` |
| D2 | **No auto-close**: when a sweep is fully clean (latest run: 0 errors), the dedup issue stays open and keeps accumulating misleading comments | issue #8 still open, 4 comments, no resolution |
| D3 | Comments contain **no detail** (which check failed, which links) — poor observability | comment bodies are bare run links |
| D4 | Issue #8 is stale: its tracker items are resolved but it's still open with a dated title | issue #8 |

## User Stories

- As a **maintainer**, I want the nightly issue to tell me *what* failed (which check, which links) so I don't open the run log to find out.
- As a **maintainer**, I want the dedup issue to close itself when health returns so stale alarms don't cry wolf.
- As a **maintainer**, I want green runs to stay silent unless there's a real status change.

## Boundaries

**Always do:**
- Preserve the existing gate behavior: verify:db + smoke checks are hard failures (fail the job); lychee stays informational (`continue-on-error`)
- Keep issue deduplication by the `nightly-alert` label (one open issue at a time)
- Verify each change against a real workflow run (dispatch) before closing the spec

**Ask first:**
- Changing which URLs the sweep checks or the accept-list (current: 200,204,301,302,307,308,403,415,429)
- Making lychee a hard gate again

**Never do:**
- Comment on green runs that have no new information
- Create duplicate issues for the same failure window

## Acceptance Criteria

- **AC-1 [MUST]** When any hard check (verify:db, smoke) fails, the issue comment names the failing check; when only lychee has findings, the comment lists the failing links (from the lychee report) instead of a bare run URL.
- **AC-2 [MUST]** When a run is fully clean (hard checks pass + lychee has no findings), and an open `nightly-alert` issue exists, the workflow closes it with a resolution comment naming the clean run.
- **AC-3 [MUST]** A green run with no open `nightly-alert` issue produces no issue activity (silent success).
- **AC-4 [MUST]** The misleading "Still failing" wording is removed; new comments accurately describe the failure type (hard-check failure vs link-sweep findings).
- **AC-5 [MUST]** Issue #8 is closed with a resolution comment summarizing the verified fixes (YouTube channels, repo-public, unccelearn bot-block, manuscdn absent).
- **AC-6 [SHOULD]** The fixed workflow is verified by: (a) a dispatched run that is green and silent (AC-3, after #8 is closed), and (b) logic review or a forced-failure test of the close/reopen path.
- **AC-7 [SHOULD]** `AGENTS.md` / workflow comments document the issue-lifecycle behavior (open on failure, comment on repeat, close on clean).

## Non-Functional Requirements

- No changes to check commands themselves (verify:db, smoke, lychee args) except report plumbing
- Workflow remains idempotent across repeated failures (one issue, comments appended)
- gh CLI-based issue operations only (no third-party actions)

## Out of Scope

- Content-side link fixes (all resolved — see Research Summary)
- Changing the sweep URL list, schedule, or accept-list
- Slack/n8n notifications (WS-G deferred in dev-env-automation)
- Refactoring the smoke checks

## Open Questions

- [RESOLVED] unccelearn 403 → alive for real users (MCP search), stays in accept-list
- [RESOLVED] manuscdn links → absent from DB content
- [RESOLVED] All original lychee findings resolved or bot-blocked

## Completion Verification (2026-07-21)

| AC | Result |
|----|--------|
| AC-1/AC-4 | ✅ proven live: first post-fix dispatch found a real LINKS failure — comment typed `LINKS` with the failing URL + status extracted from `lychee/out.md` (run 29789873892, issue #8 comment). HARD branch: logic-reviewed (outcome semantics: hard failure skips lychee, branches mutually exclusive) |
| AC-2 | ✅ after the 202 fix, dispatch 29790226502 (clean) auto-closed issue #8 with the clean-run comment — state: CLOSED ✓ |
| AC-3 | ✅ dispatch 29790332551 (clean): 0 open nightly-alert issues, comment count unchanged — silent green ✓ |
| AC-5 | ✅ resolution summary posted on #8 before auto-close (comment 5028708569) |
| AC-6 | ✅ two real dispatches (close-path + silence-path); failure-branch by logic review |
| AC-7 | ✅ AGENTS.md documents the issue lifecycle |
| Bonus | The new workflow caught a real finding on its first run: hkgreenfinance.org returns **202** to lychee's agent but 200 with full content to browser UAs → 202 added to the accept-list (bot-challenge class, same as 403/415/429) |

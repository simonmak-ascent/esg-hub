# Contract: GitHub Settings & Configs

All changes via REST API with the `SIMONMAK_ASCENT_PAT` token or files in `.github/`. Each is verified by a read-back call and logged in `log-review.md`.

## 1. Ruleset `main-protection` (AC-A16 branch protection + AC-C1/C2/CE1 Copilot auto-review)

`POST /repos/simonmak-ascent/esg-hub/rulesets`

```json
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "non_fast_forward" },
    { "type": "required_status_checks",
      "parameters": { "required_status_checks": [{ "context": "check" }] } },
    { "type": "copilot_code_review" }
  ],
  "bypass_actors": [
    { "actor_id": 264610434, "actor_type": "User", "bypass_mode": "always" }
  ]
}
```

**Gate-3 decision (pragmatic bypass):** the repo admin user is a bypass actor — direct pushes to `main` remain possible for the maintainer; force-push block and Copilot auto-review still apply. (`actor_id` = the account's numeric GitHub user id, resolved at implementation via `GET /user` for the simonmak-ascent token — 264610434 shown is humanity4ai's and serves only as a shape example.)

- Verify: `GET /repos/simonmak-ascent/esg-hub/rulesets` returns the active ruleset.
- Fallback R3: if the API rejects `copilot_code_review`, POST without it and document the UI toggle (Settings → Rules → Rulesets → "Automatically request Copilot code review") as a user action.
- Fallback R2 (no Copilot subscription): rule never fires, no red checks (AC-CE1); reported to user.
- Invariant: Copilot review is advisory; it is NOT added as a required status check (AC-C2).

## 2. `.github/dependabot.yml` (AC-D1)

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 5
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 3
```

AC-DE1: after one weekly cycle, check the Dependabot tab/logs; if `file:../tool_package` breaks the npm ecosystem, remove that block (keep github-actions) and log the verdict.

## 3. Security toggles (AC-D2, AC-D3, AC-D4)

| Change | Call | Success check |
|--------|------|---------------|
| Vulnerability alerts on | `PUT /repos/simonmak-ascent/esg-hub/vulnerability-alerts` | GET returns 204 |
| Automated security fixes on | `PUT /repos/simonmak-ascent/esg-hub/automated-security-fixes` | GET `{"enabled":true}` |
| Secret scanning + push protection | `PATCH /repos/simonmak-ascent/esg-hub` body `{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}` | GET shows enabled |

If the PATCH is rejected (plan limitation on free private repo): add a `gitleaks` job to `test.yml` (image `zricethezav/gitleaks:latest`, `detect --source . --redact`) and record the plan-limitation verdict in `log-review.md` (AC-D4 alternative satisfied).

## 4. `.github/PULL_REQUEST_TEMPLATE.md` (AC-E1)

Sections: **Summary** · **Spec reference** (`specs/<feature>/spec.md` link, per SDD living-document rule) · **Test plan** (which gate/workflow verifies) · **Checklist** (lint/tsc/vitest green, spec updated, no secrets).

## 5. Vercel project settings (AC-A6, AC-A7)

| Change | Call | Success check |
|--------|------|---------------|
| Node 22.x | `PATCH /v9/projects/esg-hub?teamId=...` `{"nodeVersion":"22.x"}` | GET shows `22.x` |
| Preview protection off | `PATCH /v9/projects/esg-hub?teamId=...` `{"ssoProtection":null}` (exact payload verified at implementation; if rejected, dashboard fallback steps documented for user) | GET shows protection disabled for previews; unauthenticated curl on next preview URL → 200 |

# Contract: Production Deploy Job (deploy.yml)

Locks the `deploy` job shape of `.github/workflows/deploy.yml` after Gate 2. Replaces the API-trigger + poll mechanism. The `check` job is unchanged (ci-cd-process AC-1 gate order preserved).

## Job contract

```yaml
deploy:
  runs-on: ubuntu-latest
  needs: check
  steps:
    # 1. Checkout (esg-hub) — unchanged
    # 2. Checkout tool_packages (simonmak-ascent/tool_packages, ref master, TOOL_PACKAGES_PAT) + symlink to ../tool_package — unchanged
    # 3. pnpm/action-setup@v4, actions/setup-node@v4 (node 20, cache pnpm) — unchanged
    # 4. pnpm install --frozen-lockfile
    # 5. Install Vercel CLI: pnpm add -g vercel@latest
    # 6. vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
    # 7. vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
    # 8. Deploy + capture URL:
    #    DEPLOY_URL=$(vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }})
    #    echo "deploy_url=$DEPLOY_URL" >> $GITHUB_OUTPUT   (step id: deploy)
    # 9. Install Playwright: pnpm exec playwright install chromium
    # 10. E2E: pnpm test   env: BASE_URL=${{ steps.deploy.outputs.deploy_url }}, CI=true
    # 11. Upload playwright-report artifact (if: always()) — unchanged
    # 12. Notify n8n on failure (if: failure(), continue-on-error: true) — see automation-workflows.md §Notify
```

## Invariants

- `needs: check` — no deploy without green gates (ci-cd-process AC-1)
- `vercel build` failure fails the job immediately at step 7 (no polling ambiguity)
- `vercel deploy --prebuilt --prod` is the only production-deploy path; no `POST /v13/deployments` gitSource trigger remains
- E2E against the deployment URL remains blocking (ci-cd-process AC-4 / spec AC-A5)
- `TOOL_PACKAGES_PAT`, `VERCEL_TOKEN` stay in GitHub secrets; nothing Vercel-side is added

## Removed (superseded)

- `POST https://api.vercel.com/v13/deployments` trigger step
- "Wait for deployment to be ready" poll loop (supersedes `specs/ci-cd-process/contracts/vercel-api.md`; that spec is amended in task T-14)

## Verification

- Push to main → workflow `success`; Vercel API shows deployment READY for the SHA; `https://esg-hub.ascent.partners/en` serves new build (spec AC-A4)

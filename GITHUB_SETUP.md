# ESG Hub - GitHub Actions Deployment Setup

This project is configured with GitHub Actions for automatic deployment to Vercel.

## 🚀 Quick Start (One Command Setup)

Run this command in your terminal:

```bash
bash setup-github-secrets.sh
```

This script will:
- ✅ Check/install GitHub CLI
- ✅ Authenticate with GitHub
- ✅ Add all required secrets except VERCEL_TOKEN
- ⚠️ Guide you to add VERCEL_TOKEN manually

## 📋 Manual Setup (If Script Doesn't Work)

### Step 1: Get Vercel Token

1. Go to: https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: `GitHub Actions`
4. Copy the token (starts with `vrC...`)

### Step 2: Add GitHub Secrets

Go to: https://github.com/simonplmak-cloud/esg-hub/settings/secrets/actions

Click "New repository secret" and add these:

| Secret Name | Value |
|-------------|-------|
| `VERCEL_TOKEN` | (Your token from Step 1) |
| `VERCEL_ORG_ID` | `team_WdRBvuyKYcVGwtSk1T9dIoaY` |
| `VERCEL_PROJECT_ID` | `prj_8xuRJNmQRl2mF9qiR7nEWrQIJPwk` |
| `SURREAL_URL` | `https://valuation-webap-06dvm6i94trq92goln8f5gebnk.aws-euw1.surreal.cloud` |
| `SURREAL_USERNAME` | `root` |
| `SURREAL_PASSWORD` | `ValuationApp2026!` |
| `SURREAL_NAMESPACE` | `esg_hub` |
| `SURREAL_DATABASE` | `main` |

### Step 3: Verify Deployment

Push any change to main:

```bash
git commit --allow-empty -m "trigger deployment"
git push origin main
```

Then check the Actions tab: https://github.com/simonplmak-cloud/esg-hub/actions

## 🔄 What Happens Automatically

### On Push to Main
- ✅ Runs linter
- ✅ Builds application
- ✅ Deploys to Vercel production

### On Pull Request
- ✅ Creates preview deployment
- ✅ Comments PR with preview URL

## 🔗 Important URLs

- **Production Site**: https://hidden-harbor.vercel.app
- **GitHub Repo**: https://github.com/simonplmak-cloud/esg-hub
- **Actions Dashboard**: https://github.com/simonplmak-cloud/esg-hub/actions
- **Vercel Dashboard**: https://vercel.com/simon-maks-projects/hidden-harbor

## 🛠️ Troubleshooting

### Workflow Not Triggering
- Check if secrets are added correctly
- Ensure workflows are in `.github/workflows/` directory
- Check Actions tab for errors

### Build Fails
- Check Vercel build logs
- Verify environment variables are set
- Check if SurrealDB is accessible

### Deployment Permission Denied
- Regenerate Vercel token
- Ensure token has project access
- Re-add token to GitHub secrets

## 📦 Files Added

```
.github/
├── workflows/
│   ├── deploy.yml          # Production deployment
│   └── deploy-preview.yml  # Preview deployments for PRs
├── setup-github-secrets.sh # Automated setup script
└── GITHUB_SETUP.md         # This file
```

## 📝 Next Steps After Setup

1. ✅ Add GitHub secrets (via script or manual)
2. ✅ Push empty commit to trigger first deployment
3. ✅ Verify deployment in Actions tab
4. ✅ Test live site
5. ✅ Setup branch protection rules (optional)

---

**Status**: ⏳ Waiting for GitHub secrets to be configured

Once secrets are added, every push to `main` will automatically deploy to production!

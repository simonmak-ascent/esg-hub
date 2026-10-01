#!/bin/bash

# Automatic GitHub Secrets Setup Script for ESG Hub
# This script will be executed by the user

set -e

echo "🚀 Setting up GitHub Secrets for Vercel Deployment"
echo "================================================"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo ""
    echo "Installing GitHub CLI..."
    
    # Detect OS and install
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update
        sudo apt install gh -y
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install gh
        else
            echo "Please install Homebrew first: https://brew.sh"
            exit 1
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        # Windows
        echo "Please install GitHub CLI manually:"
        echo "1. Download from: https://cli.github.com/"
        echo "2. Or use winget: winget install --id GitHub.cli"
        exit 1
    fi
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "🔐 Please login to GitHub..."
    gh auth login
fi

# Get the repository
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "simonplmak-cloud/esg-hub")

echo "📁 Repository: $REPO"
echo ""

# Secrets to add
declare -A secrets=(
    ["VERCEL_ORG_ID"]="team_WdRBvuyKYcVGwtSk1T9dIoaY"
    ["VERCEL_PROJECT_ID"]="prj_8xuRJNmQRl2mF9qiR7nEWrQIJPwk"
    ["SURREAL_URL"]="https://valuation-webap-06dvm6i94trq92goln8f5gebnk.aws-euw1.surreal.cloud"
    ["SURREAL_USERNAME"]="root"
    ["SURREAL_PASSWORD"]="ValuationApp2026!"
    ["SURREAL_NAMESPACE"]="esg_hub"
    ["SURREAL_DATABASE"]="main"
)

echo "🔑 Adding secrets to GitHub..."
echo ""

for key in "${!secrets[@]}"; do
    value="${secrets[$key]}"
    echo -n "  Setting $key... "
    
    if gh secret set "$key" -b"$value" -R "$REPO" 2>/dev/null; then
        echo "✅"
    else
        echo "❌ Failed"
    fi
done

echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "================================"
echo "Please add VERCEL_TOKEN manually:"
echo ""
echo "1. Go to: https://vercel.com/account/tokens"
echo "2. Click 'Create Token'"
echo "3. Name it 'GitHub Actions'"
echo "4. Copy the token"
echo "5. Run: gh secret set VERCEL_TOKEN -b'YOUR_TOKEN' -R $REPO"
echo ""
echo "Or use the web UI:"
echo "https://github.com/$REPO/settings/secrets/actions"
echo ""

# List current secrets
echo "📋 Current secrets in repository:"
echo "================================"
gh secret list -R "$REPO" 2>/dev/null || echo "Unable to list secrets (requires authentication)"

echo ""
echo "🎉 Setup complete! (Except VERCEL_TOKEN)"
echo ""
echo "Next steps:"
echo "1. Add VERCEL_TOKEN as shown above"
echo "2. Push any change to main branch to trigger deployment"
echo ""

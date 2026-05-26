#!/bin/bash

set -e

echo "🔍 Vercel Deployment Setup Verification"
echo "========================================"
echo ""

# Check 1: Vercel CLI
echo "1️⃣  Checking Vercel CLI..."
if command -v vercel &> /dev/null; then
    VERCEL_VERSION=$(vercel --version 2>&1)
    echo "   ✅ Vercel CLI installed: $VERCEL_VERSION"
else
    echo "   ❌ Vercel CLI not found. Install with: npm install -g vercel"
    exit 1
fi

# Check 2: Vercel Project Link
echo ""
echo "2️⃣  Checking Vercel project link..."
if [ -f "frontend/.vercel/project.json" ]; then
    ORG_ID=$(jq -r '.orgId' frontend/.vercel/project.json 2>/dev/null || echo "")
    PROJECT_ID=$(jq -r '.projectId' frontend/.vercel/project.json 2>/dev/null || echo "")
    echo "   ✅ Project linked"
    echo "   Organization ID: $ORG_ID"
    echo "   Project ID: $PROJECT_ID"
else
    echo "   ⚠️  Project not linked. Run 'cd frontend && vercel link'"
fi

# Check 3: Build configuration
echo ""
echo "3️⃣  Checking build configuration..."
if [ -f "frontend/package.json" ]; then
    BUILD_CMD=$(jq -r '.scripts.build' frontend/package.json)
    echo "   ✅ Build command: $BUILD_CMD"
else
    echo "   ❌ package.json not found"
    exit 1
fi

# Check 4: Environment variables
echo ""
echo "4️⃣  Checking environment setup..."
if [ -f "frontend/.env.local" ]; then
    ENV_COUNT=$(grep -c "^[A-Z]" frontend/.env.local || echo "0")
    echo "   ✅ Local env file present ($ENV_COUNT variables)"
else
    echo "   ⚠️  No .env.local file found"
fi

# Check 5: Vercel config
echo ""
echo "5️⃣  Checking Vercel configuration..."
if [ -f "vercel.json" ] || [ -f "frontend/vercel.json" ]; then
    echo "   ✅ vercel.json found"
else
    echo "   ⚠️  No vercel.json configuration found"
fi

# Check 6: GitHub workflow
echo ""
echo "6️⃣  Checking GitHub Actions workflow..."
if [ -f ".github/workflows/vercel-deploy.yml" ]; then
    echo "   ✅ Workflow file exists"
    # Check if it has the expected structure
    if grep -q "Deploy to Vercel" .github/workflows/vercel-deploy.yml; then
        echo "   ✅ Workflow configuration looks good"
    fi
else
    echo "   ❌ Workflow file not found"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ All checks passed!"
echo ""
echo "📋 Next steps:"
echo "1. Ensure VERCEL_TOKEN is set in GitHub secrets (Settings → Secrets and variables)"
echo "2. Verify Vercel project is linked: cd frontend && vercel link"
echo "3. Test manual deployment: gh workflow run vercel-deploy.yml"
echo "4. Check GitHub Actions logs for deployment status"
echo ""

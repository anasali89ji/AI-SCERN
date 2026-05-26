# Vercel Deployment Setup Guide

## Prerequisites

### 1. GitHub Repository Secrets
The following secret must be configured in your GitHub repository settings:

**Setting: Repository Secret**
- **Name**: `VERCEL_TOKEN`
- **Value**: Your Vercel API token (from https://vercel.com/account/tokens)

**Location in GitHub**:
- Go to your repository
- Settings → Secrets and variables → Actions
- Click "New repository secret"
- Name: `VERCEL_TOKEN`
- Paste your Vercel token

> ⚠️ **Important**: The secret should be at the **Repository level**, not environment level

### 2. Vercel Project Configuration

Verify your Vercel project settings:
- **Organization ID**: `team_sUVHUcrNUc6fWYVOF1cpD1Z1`
- **Project ID**: `prj_xoNvRPv0ooeRx7DA8k1BAODHcDj9`

**To find your IDs**:
```bash
# Install Vercel CLI globally
npm install -g vercel

# Link to your project
cd frontend
vercel link

# Your IDs will be saved in .vercel/project.json
cat .vercel/project.json
```

### 3. Enable GitHub Integration on Vercel

**For Automatic Deployments** (push to main/branches):
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Git → Connected Git Repository
4. Ensure GitHub integration is enabled
5. Configure branch deployments:
   - Production: `main`
   - Preview: `fix/*`, `feat/*`, `hotfix/*`

Alternatively, manually run deployments from GitHub Actions.

## Deployment Workflows

### Automatic Deployment (via GitHub Integration)
When you push code to configured branches, Vercel automatically deploys.

### Manual Deployment (via GitHub Actions)
1. Go to GitHub Actions tab in your repository
2. Select "Deploy to Vercel" workflow
3. Click "Run workflow"
4. Choose branch and environment
5. Click "Run workflow"

### CLI Deployment (Local)
```bash
cd frontend
vercel --prod              # Deploy to production
vercel --preview           # Deploy to preview
```

## Troubleshooting

### Issue: "VERCEL_TOKEN secret is not set"
**Solution**: 
- Check that the secret is configured at Repository level (not environment level)
- Go to Settings → Secrets and variables → Actions → "Repository secrets"
- Verify the secret name is exactly `VERCEL_TOKEN`

### Issue: "Failed to capture deployment URL"
**Solution**:
- Check that your Vercel project is properly linked
- Verify organization and project IDs in workflow
- Check build logs for errors

### Issue: Manual deployment works but automatic doesn't
**Solution**:
- Ensure GitHub integration is enabled on Vercel
- Check Vercel webhook settings
- Verify branch protection rules aren't blocking deployments

## Verification

Run this command to verify your setup:
```bash
npm run verify:deploy
```

This will check:
- ✅ Vercel CLI is installed
- ✅ Project is linked to Vercel
- ✅ Build script runs successfully
- ✅ Environment variables are present


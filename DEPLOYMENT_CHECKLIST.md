# ✅ Vercel Deployment Setup Checklist

## Pre-Deployment Requirements

### GitHub Configuration
- [ ] Have a GitHub personal access token (optional, for `gh` commands)
- [ ] Have Vercel API token ready
  - Get from: https://vercel.com/account/tokens
  - Scope: "Full Access"

### Vercel Configuration  
- [ ] Project exists in Vercel dashboard
- [ ] Organization ID: `team_sUVHUcrNUc6fWYVOF1cpD1Z1`
- [ ] Project ID: `prj_xoNvRPv0ooeRx7DA8k1BAODHcDj9`

---

## Setup Steps

### 1. Add GitHub Secret (REQUIRED)
```
Repository: https://github.com/YOUR_REPO
Settings → Secrets and variables → Actions → New repository secret

Name: VERCEL_TOKEN
Value: [your-vercel-token-here]
```
**Status**: [ ] Complete

---

### 2. Verify Vercel Project IDs (REQUIRED)
```bash
# Expected to match workflow values
cd frontend && cat .vercel/project.json
```
**Status**: [ ] Verified

---

### 3. Configure Vercel GitHub Integration (for auto-deploy)
```
https://vercel.com/dashboard → Select Project
Settings → Git → Connected Git Repository

✓ Ensure "Connect Git Repository" is enabled
✓ GitHub integration is active
```
**Status**: [ ] Configured

---

### 4. Enable Branch Deployments on Vercel
```
Vercel Dashboard → Project Settings → Git

Production Branch: main
Preview Branches: fix/*, feat/*, hotfix/*
```
**Status**: [ ] Enabled

---

## Testing

### Test 1: Manual Deployment (GitHub Actions)
```bash
# Trigger workflow from GitHub CLI
gh workflow run vercel-deploy.yml --ref main

# Check status
gh run list --workflow vercel-deploy.yml -L 1
```
**Status**: [ ] ✅ Success

**Expected Output**:
```
✅ Vercel Token is configured
✅ Successfully deployed to: https://aiscern.vercel.app/
```

---

### Test 2: Automatic Deployment (Push to Feature Branch)
```bash
# Create and push feature branch
git checkout -b feat/test-deployment
echo "# Test" >> README.md
git add .
git commit -m "test: trigger deployment"
git push -u origin feat/test-deployment

# Watch GitHub Actions
# → https://github.com/YOUR_REPO/actions
```
**Status**: [ ] ✅ Triggered

**Expected**: GitHub Actions workflow runs automatically

---

### Test 3: Production Deployment (Push to Main)
```bash
# Update main branch (after PR/merge)
git checkout main
git pull origin main

# Verify deployment triggered
# → Check GitHub Actions
# → Check Vercel dashboard
```
**Status**: [ ] ✅ Success

---

## Troubleshooting Quick Guide

| Issue | Quick Fix |
|-------|-----------|
| `VERCEL_TOKEN secret is not set` | Add secret to GitHub repo settings |
| `Failed to capture deployment URL` | Check build logs, verify vercel.json |
| Manual works, auto doesn't | Enable GitHub integration in Vercel |
| Deployment slow | Check Node version (should be 20) |
| Build fails | Run `npm run build` locally to test |

---

## Documentation Files

- 📄 `VERCEL_DEPLOYMENT_FIX.md` - Comprehensive fix details
- 📄 `DEPLOYMENT_SETUP.md` - Setup guide
- 📄 `DEPLOYMENT_CHECKLIST.md` - This file
- 📄 `verify-deploy.sh` - Verification script

---

## Success Indicators

✅ **Checklist Complete When**:
1. GitHub Actions workflow runs without errors
2. Deployment URL is successfully captured
3. Preview URLs are accessible
4. Production deployment works on main branch
5. Automatic deployments trigger on push

---

**Status**: Ready for deployment
**Last Updated**: 2026-05-26

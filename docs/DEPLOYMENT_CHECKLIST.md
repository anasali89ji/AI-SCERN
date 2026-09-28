# Deployment Checklist — Main Branch Overhaul 2026

## Pre-Deploy Verification

```bash
cd frontend
npm ci
npm run type-check      # Must pass with 0 errors
npm run lint            # Must pass with 0 errors
npm run test            # Must pass with 0 failures
npm run build           # Must complete with 0 errors
```

## Database Migrations (apply in order)

1. `v10_onboarding_state.sql`
2. `v11_workflow_system.sql`
3. `v12_model_registry.sql`

## Environment Variables

Ensure ALL required env vars are set in Vercel/DigitalOcean:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
GEMINI_API_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
CLOUDFLARE_D1_DATABASE_ID
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
SIGNAL_WORKER_URL
SIGNAL_WORKER_API_KEY
SIGNAL_WORKER_WEBHOOK_SECRET
INTERNAL_API_SECRET
NEXT_PUBLIC_APP_URL
LOG_LEVEL
```

## Git Strategy

```bash
# Tag current main before merge
git tag pre-overhaul-$(date +%Y%m%d)

# Create feature branch
git checkout -b feat/main-overhaul-2026

# Module commits
git add .
git commit -m "module(0): baseline audit and env validation"
git commit -m "module(1): auth system reconstruction with clerk"
git commit -m "module(2): onboarding engine with first-run detection"
git commit -m "module(3): dashboard UX polish - sidebar, skeletons, empty states"
git commit -m "module(4): workflow system architecture"
git commit -m "module(5): signal worker integration"
git commit -m "module(6): dataset pipeline and model registry"
git commit -m "module(7): backend API hardening - rate limits, error handling"
git commit -m "module(8): end-to-end integration tests"
git commit -m "module(9): deployment config and migrations"

# Push and PR
git push origin feat/main-overhaul-2026
```

## Rollback Plan

- Keep old deployment as backup domain
- If critical errors within 1 hour: `git revert HEAD~9..HEAD`

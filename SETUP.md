# Aiscern — Setup Guide

Complete setup instructions for deploying Aiscern from scratch.

---

## 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Clerk](https://clerk.com) application
- A [Vercel](https://vercel.com) account
- A [Cloudflare](https://cloudflare.com) account (for R2 storage)
- An [Upstash](https://upstash.com) Redis database
- A [HuggingFace](https://huggingface.co) account with API token
- A [Google AI Studio](https://aistudio.google.com) Gemini API key (free tier works)

---

## 2. Clone & Install

```bash
git clone https://github.com/saghirahmed9067-png/DETECT-AI.git
cd DETECT-AI/frontend
npm install --legacy-peer-deps
cp .env.example .env.local
# Fill in all values in .env.local
```

---

## 3. Environment Variables

See `frontend/.env.example` for the full list with descriptions. Minimum required for local dev:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
HUGGINGFACE_API_TOKEN
GEMINI_API_KEY
```

---

## 4. Supabase — Database Setup

Run the following SQL in your Supabase SQL Editor (**Dashboard → SQL Editor → New Query**).

### 4.1 Core Tables

```sql
-- Scans table (primary data store)
CREATE TABLE IF NOT EXISTS scans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  media_type       text NOT NULL CHECK (media_type IN ('text','image','audio','video')),
  verdict          text NOT NULL CHECK (verdict IN ('AI','HUMAN','UNCERTAIN')),
  confidence_score numeric NOT NULL DEFAULT 0,
  content_preview  text,
  file_name        text,
  file_size        bigint,
  signals          jsonb,
  model_used       text,
  model_version    text,
  processing_time  integer,
  status           text NOT NULL DEFAULT 'complete',
  user_feedback    text CHECK (user_feedback IN ('correct','incorrect')),
  is_public        boolean NOT NULL DEFAULT false,
  metadata         jsonb,
  r2_key           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_user_id    ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_public     ON scans(id) WHERE is_public = true;

-- API keys table (public API authentication)
CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  name         text NOT NULL DEFAULT 'My API Key',
  is_active    boolean NOT NULL DEFAULT true,
  calls_today  integer NOT NULL DEFAULT 0,
  daily_limit  integer NOT NULL DEFAULT 1000,
  total_calls  integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- Training feedback (model improvement loop)
CREATE TABLE IF NOT EXISTS training_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       uuid NOT NULL UNIQUE,
  text_preview  text,
  model_verdict text NOT NULL,
  user_says     text NOT NULL,
  confidence    numeric,
  media_type    text DEFAULT 'text',
  logged_at     timestamptz NOT NULL DEFAULT now()
);

-- Pipeline jobs (background work queue)
CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type   text NOT NULL,
  priority   integer NOT NULL DEFAULT 5,
  payload    jsonb,
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 4.2 Required SQL Functions

These functions are called by the application at runtime. **Run all of them.**

```sql
-- Dashboard stats per user
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id text)
RETURNS TABLE (
  total_scans      bigint,
  ai_detected      bigint,
  human_detected   bigint,
  uncertain_count  bigint,
  avg_confidence   numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)                                          AS total_scans,
    COUNT(*) FILTER (WHERE verdict = 'AI')            AS ai_detected,
    COUNT(*) FILTER (WHERE verdict = 'HUMAN')         AS human_detected,
    COUNT(*) FILTER (WHERE verdict = 'UNCERTAIN')     AS uncertain_count,
    ROUND(AVG(confidence_score)::numeric * 100, 1)    AS avg_confidence
  FROM scans
  WHERE user_id = p_user_id;
$$;

-- Atomic API call counter increment
CREATE OR REPLACE FUNCTION increment_api_calls(key_hash_input text)
RETURNS void LANGUAGE sql AS $$
  UPDATE api_keys
  SET
    calls_today = calls_today + 1,
    total_calls = total_calls + 1
  WHERE key_hash = key_hash_input;
$$;

-- Reset daily API counters at midnight UTC
-- Schedule this via Supabase pg_cron (Dashboard → Database → Cron Jobs):
-- Schedule: "0 0 * * *"  SQL: SELECT reset_api_daily_counts();
CREATE OR REPLACE FUNCTION reset_api_daily_counts()
RETURNS void LANGUAGE sql AS $$
  UPDATE api_keys SET calls_today = 0;
$$;
```

### 4.3 Row Level Security (RLS)

```sql
-- Enable RLS on scans
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own scans
CREATE POLICY "users_own_scans" ON scans
  USING (user_id = auth.uid()::text);

-- Public scans are readable by anyone
CREATE POLICY "public_scans_readable" ON scans
  FOR SELECT USING (is_public = true);

-- Enable RLS on api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_api_keys" ON api_keys
  USING (user_id = auth.uid()::text);
```

---

## 5. Cloudflare R2 — File Storage

1. Go to **Cloudflare Dashboard → R2 → Create bucket**
2. Name it `aiscern-uploads` (or set `R2_BUCKET_NAME` to your chosen name)
3. Create an R2 API token with **Object Read & Write** permissions
4. Set the following env vars:

```
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=aiscern-uploads
R2_PUBLIC_URL=https://pub-xxx.r2.dev  # or your custom domain
```

---

## 6. Upstash Redis — Rate Limiting

1. Go to [console.upstash.com](https://console.upstash.com) → Create Database → Choose region
2. Copy the REST URL and token:

```
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

The in-memory fallback rate limiter activates automatically if Redis is not configured (suitable for development).

---

## 7. Inngest — Background Jobs

1. Sign up at [inngest.com](https://inngest.com) and create an app named `aiscern`
2. Copy the Event Key and Signing Key:

```
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=signkey-prod-xxx
```

3. In your Vercel deployment, add the Inngest webhook: `https://aiscern.com/api/inngest`

---

## 8. API Master Key

Generate a secure key for the public API:

```bash
openssl rand -hex 32
```

Set as `API_MASTER_KEY` in your environment. This key bypasses Supabase api_keys table validation (for internal use only).

---

## 9. Deploy to Vercel

```bash
# From the frontend/ directory:
vercel --prod
# Or connect the repo in Vercel dashboard → Import Project → frontend/
```

Set all env vars in **Vercel Dashboard → Project → Settings → Environment Variables**.

---

## 10. Verify Deployment

```bash
# Health check
curl https://aiscern.com/api/health

# API key validation (should reject)
curl -X POST https://aiscern.com/api/v1/detect/text \
  -H "X-API-Key: fake" \
  -H "Content-Type: application/json" \
  -d '{"text":"test"}'
# Expected: {"error":"Invalid or inactive API key..."}

# Sitemap
curl https://aiscern.com/sitemap.xml | head -20
```

---

## 11. Post-Deploy SQL

Run these after the first deployment to wire up the Supabase cron jobs:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Reset API daily counters at midnight UTC every day
SELECT cron.schedule(
  'reset-api-daily-counts',
  '0 0 * * *',
  'SELECT reset_api_daily_counts()'
);
```

-- ============================================================
-- CockroachDB Read Replica Schema
-- Run this against your CockroachDB Serverless cluster
-- (NOT against Supabase — this is a separate cluster)
--
-- How to run:
--   cockroach sql --url "$COCKROACH_URL" < v15_cockroach_replica.sql
-- Or via CockroachDB Cloud console SQL editor.
-- ============================================================

-- ── 1. Create read-only replica user ─────────────────────────────────────────
-- Run this as an admin user in CockroachDB Cloud or via CLI:
--
--   CREATE USER aiscern_replica_ro WITH PASSWORD '<generate-a-strong-password>';
--   GRANT SELECT ON DATABASE aiscern TO aiscern_replica_ro;
--
-- Then set COCKROACH_REPLICA_URL in Vercel:
--   postgresql://aiscern_replica_ro:<password>@<host>:26257/aiscern?sslmode=verify-full
--
-- The existing COCKROACH_URL should use a write-capable user (aiscern_rw or similar).

-- ── 2. scan_replicas table ────────────────────────────────────────────────────
-- Mirrors scan rows from Neon (heavy DB) for fast read-only analytics.
-- Populated by the Inngest sync-scan-to-replica background job.

CREATE TABLE IF NOT EXISTS scan_replicas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  media_type  TEXT        NOT NULL DEFAULT 'unknown',
  score       FLOAT       NOT NULL DEFAULT 0,
  verdict     TEXT        NOT NULL DEFAULT 'unknown',   -- 'ai' | 'human' | 'mixed' | 'unknown'
  confidence  FLOAT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_scan_replicas_user_id    ON scan_replicas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_replicas_media_type ON scan_replicas (media_type);
CREATE INDEX IF NOT EXISTS idx_scan_replicas_verdict    ON scan_replicas (verdict);
CREATE INDEX IF NOT EXISTS idx_scan_replicas_created_at ON scan_replicas (created_at DESC);

-- Grant read to replica user
GRANT SELECT ON TABLE scan_replicas TO aiscern_replica_ro;
-- Grant write to the main app user (used by Inngest sync job via COCKROACH_URL)
GRANT INSERT, UPDATE ON TABLE scan_replicas TO aiscern_rw;

-- ── 3. platform_stats materialized view ───────────────────────────────────────
-- Pre-aggregated stats for the marketing/about page.
-- Refreshed by the nightly Inngest cron (or on-demand via API).
-- CockroachDB doesn't support MATERIALIZED VIEWs — use a regular table instead.

CREATE TABLE IF NOT EXISTS platform_stats_cache (
  id            INT         PRIMARY KEY DEFAULT 1,   -- single row
  total_scans   BIGINT      NOT NULL DEFAULT 0,
  total_users   BIGINT      NOT NULL DEFAULT 0,
  ai_detected   BIGINT      NOT NULL DEFAULT 0,
  refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with zeroes
INSERT INTO platform_stats_cache (id, total_scans, total_users, ai_detected, refreshed_at)
VALUES (1, 0, 0, 0, now())
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON TABLE platform_stats_cache TO aiscern_replica_ro;
GRANT INSERT, UPDATE ON TABLE platform_stats_cache TO aiscern_rw;

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT 'scan_replicas'       AS table_name, count(*) AS rows FROM scan_replicas
UNION ALL
SELECT 'platform_stats_cache', count(*)                      FROM platform_stats_cache;

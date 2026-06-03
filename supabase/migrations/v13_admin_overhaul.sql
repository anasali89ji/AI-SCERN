-- ============================================================
-- v13 — Admin Panel Overhaul
-- New tables: admin_sessions, announcements, support_tickets,
--             error_logs (updated), settings (updated),
--             feature_flags (updated), analytics_events,
--             api_keys (updated), payment_events,
--             admin_client_errors
-- ============================================================

-- ── 1. admin_sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT        NOT NULL UNIQUE,
  ip_address    TEXT        NOT NULL,
  user_agent    TEXT,
  revoked_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token    ON admin_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires  ON admin_sessions (expires_at);

-- Auto-purge expired sessions older than 7 days
-- (run via a cron job or pg_cron if available)

-- ── 2. admin_audit_log — ensure all columns exist ────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action     TEXT        NOT NULL,
  admin_ip   TEXT        NOT NULL,
  metadata   JSONB       DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log (created_at DESC);

-- ── 3. announcements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  content         TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'info'
                  CHECK (type IN ('info','warning','promotion','maintenance')),
  target_audience TEXT        NOT NULL DEFAULT 'all'
                  CHECK (target_audience IN ('all','free','pro','team','enterprise')),
  active          BOOLEAN     NOT NULL DEFAULT false,
  priority        INTEGER     NOT NULL DEFAULT 0,
  start_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date        TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active   ON announcements (active);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements (target_audience);

-- ── 4. support_tickets ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  subject     TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','in_progress','resolved','closed')),
  priority    TEXT        NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high','urgent')),
  category    TEXT        NOT NULL DEFAULT 'general',
  assigned_to TEXT,
  updated_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status     ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority   ON support_tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id    ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON support_tickets (created_at DESC);

-- ── 5. error_logs — upgrade ───────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT        NOT NULL,
  path        TEXT,
  count       INTEGER     NOT NULL DEFAULT 1,
  resolved    BOOLEAN     NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns if table already exists
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS path        TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS count       INTEGER     DEFAULT 1;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved    BOOLEAN     DEFAULT false;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS first_seen  TIMESTAMPTZ DEFAULT now();
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS last_seen   TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_error_logs_resolved  ON error_logs (resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON error_logs (last_seen DESC);

-- ── 6. settings — flat key/value ─────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB        NOT NULL DEFAULT 'null',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Seed default settings (INSERT … ON CONFLICT DO NOTHING)
INSERT INTO settings (key, value) VALUES
  ('maintenance_mode',  'false'),
  ('registration_open', 'true'),
  ('free_scans_limit',  '10'),
  ('pro_scans_limit',   '500'),
  ('team_scans_limit',  '2000'),
  ('max_file_size_mb',  '10'),
  ('support_email',     '"support@aiscern.com"'),
  ('site_announcement', '""')
ON CONFLICT (key) DO NOTHING;

-- ── 7. feature_flags — add name column ───────────────────────
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS rollout_percentage INTEGER DEFAULT 100;
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ;

-- Back-fill name from key for existing rows
UPDATE feature_flags SET name = key WHERE name IS NULL;

-- ── 8. analytics_events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT        NOT NULL,
  user_id    UUID,
  session_id TEXT,
  metadata   JSONB       DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type       ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id    ON analytics_events (user_id);

-- ── 9. api_keys — add missing columns ────────────────────────
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS name         TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix   TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS permissions  TEXT[]      DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit   INTEGER     DEFAULT 1000;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at   TIMESTAMPTZ;

-- Back-fill key_prefix from existing hash/key columns if present
UPDATE api_keys
SET key_prefix = left(COALESCE(key_hash, id::text), 8)
WHERE key_prefix IS NULL;

-- ── 10. payment_events ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency      TEXT        NOT NULL DEFAULT 'USD',
  status        TEXT        NOT NULL CHECK (status IN ('succeeded','failed','refunded','pending')),
  gateway       TEXT        NOT NULL DEFAULT 'stripe',
  error_message TEXT,
  retried       BOOLEAN     NOT NULL DEFAULT false,
  metadata      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id   ON payment_events (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_status    ON payment_events (status);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON payment_events (created_at DESC);

-- ── 11. subscriptions — ensure columns ───────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency         TEXT        NOT NULL DEFAULT 'USD',
  billing_interval TEXT        NOT NULL DEFAULT 'month'
                   CHECK (billing_interval IN ('month','year')),
  status           TEXT        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','cancelled','past_due','trialing')),
  gateway          TEXT        NOT NULL DEFAULT 'stripe',
  external_id      TEXT        UNIQUE,
  current_period_end TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions (status);

-- ── 12. admin_client_errors ──────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_client_errors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message    TEXT        NOT NULL,
  stack      TEXT,
  tab        TEXT,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 13. RLS — admin tables only accessible via service role ──
ALTER TABLE admin_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_client_errors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events        ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically in Supabase.
-- Block all anon/authenticated access to admin-only tables.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'admin_sessions','admin_audit_log','admin_client_errors','payment_events'
  ] LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS block_public ON %I;
      CREATE POLICY block_public ON %I FOR ALL TO PUBLIC USING (false);
    ', tbl, tbl);
  END LOOP;
END $$;

-- announcements: readable by authenticated users, writable only by service role
DROP POLICY IF EXISTS anon_read_announcements ON announcements;
CREATE POLICY anon_read_announcements ON announcements
  FOR SELECT TO authenticated
  USING (active = true AND (end_date IS NULL OR end_date > now()));

-- support_tickets: users can read/create their own
DROP POLICY IF EXISTS own_tickets ON support_tickets;
CREATE POLICY own_tickets ON support_tickets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

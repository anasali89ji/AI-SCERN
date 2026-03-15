-- DETECTAI — Database Hardening Migration
-- Run in Supabase SQL Editor

-- ── 1. Performance Indexes ──────────────────────────────────────────────────

-- scans table — most queried table
CREATE INDEX IF NOT EXISTS idx_scans_user_id          ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at       ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_verdict          ON scans(verdict);
CREATE INDEX IF NOT EXISTS idx_scans_media_type       ON scans(media_type);
CREATE INDEX IF NOT EXISTS idx_scans_user_created     ON scans(user_id, created_at DESC);

-- profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id       ON profiles(plan_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email         ON profiles(email);

-- ── 2. Admin System Tables ──────────────────────────────────────────────────

-- Admin roles
CREATE TABLE IF NOT EXISTS admin_roles (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL CHECK(name IN ('super_admin','admin','moderator','analyst','viewer')),
  permissions JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO admin_roles (name, permissions) VALUES
  ('super_admin', '{"all": true}'),
  ('admin',       '{"users": true, "scans": true, "pipeline": true, "settings": true}'),
  ('moderator',   '{"scans": true, "users_read": true}'),
  ('analyst',     '{"analytics": true, "scans_read": true}'),
  ('viewer',      '{"dashboard_read": true}')
ON CONFLICT (name) DO NOTHING;

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' REFERENCES admin_roles(name),
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id              BIGSERIAL PRIMARY KEY,
  admin_id        UUID REFERENCES admin_users(id),
  action_type     TEXT NOT NULL,
  target_resource TEXT,
  target_id       TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id   ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action     ON admin_activity_logs(action_type);

-- Platform settings (feature flags + config)
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES admin_users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('scraping_enabled',    'true',   'Enable/disable all CF Workers scraping'),
  ('max_file_size_mb',    '25',     'Max upload size in MB'),
  ('rate_limit_per_min',  '20',     'API rate limit per IP per minute'),
  ('ai_inference_enabled','true',   'Enable/disable HF inference'),
  ('maintenance_mode',    'false',  'Put site in maintenance mode'),
  ('free_scans_per_day',  '10',     'Free tier daily scan limit')
ON CONFLICT (key) DO NOTHING;

-- Domain blocklist for scraper
CREATE TABLE IF NOT EXISTS blocked_domains (
  id          SERIAL PRIMARY KEY,
  domain      TEXT UNIQUE NOT NULL,
  reason      TEXT,
  blocked_by  UUID REFERENCES admin_users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Security events
CREATE TABLE IF NOT EXISTS security_events (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL CHECK(event_type IN ('rate_limit','failed_auth','suspicious_ip','abuse_detected','data_breach_attempt')),
  ip_address  TEXT,
  user_id     UUID,
  details     JSONB DEFAULT '{}',
  severity    TEXT DEFAULT 'low' CHECK(severity IN ('low','medium','high','critical')),
  resolved    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_events_type       ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity   ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);

-- Error log
CREATE TABLE IF NOT EXISTS error_logs (
  id          BIGSERIAL PRIMARY KEY,
  service     TEXT NOT NULL CHECK(service IN ('api','scraper','worker','inference','auth')),
  error_code  TEXT,
  message     TEXT NOT NULL,
  stack_trace TEXT,
  context     JSONB DEFAULT '{}',
  user_id     UUID,
  resolved    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_error_logs_service    ON error_logs(service);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved   ON error_logs(resolved);

-- ── 3. RLS Policies ─────────────────────────────────────────────────────────

ALTER TABLE admin_activity_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_domains      ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users          ENABLE ROW LEVEL SECURITY;

-- Only service role can access admin tables
CREATE POLICY "Service role only - admin_activity_logs" ON admin_activity_logs
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only - platform_settings" ON platform_settings
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only - blocked_domains" ON blocked_domains
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only - security_events" ON security_events
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only - error_logs" ON error_logs
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only - admin_users" ON admin_users
  USING (auth.role() = 'service_role');

-- ── 4. Scans RLS (ensure users only see their own) ───────────────────────────
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own scans" ON scans
  FOR SELECT USING (auth.uid()::text = user_id OR auth.role() = 'service_role');
CREATE POLICY "Users insert own scans" ON scans
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role full access scans" ON scans
  FOR ALL USING (auth.role() = 'service_role');

-- ── 5. Profiles RLS ─────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT USING (auth.uid()::text = id OR auth.role() = 'service_role');
CREATE POLICY "Service role full access profiles" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

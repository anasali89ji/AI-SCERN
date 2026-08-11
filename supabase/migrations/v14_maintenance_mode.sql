-- ============================================================
-- v14_maintenance_mode.sql — Maintenance Mode System
-- Run in Supabase SQL Editor
-- ============================================================

-- site_settings table (used by admin maintenance API)
CREATE TABLE IF NOT EXISTS site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default maintenance settings
INSERT INTO site_settings (key, value, updated_at) VALUES
  ('maintenance_enabled',     'false', NOW()),
  ('maintenance_message',     'We are currently performing scheduled maintenance. Please check back soon.', NOW()),
  ('maintenance_duration',    '', NOW()),
  ('maintenance_allowed_ips', '[]', NOW())
ON CONFLICT (key) DO NOTHING;

-- RLS: only service_role can access
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only - site_settings" ON site_settings
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);

-- Sync with legacy platform_settings if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_settings') THEN
    INSERT INTO site_settings (key, value, updated_at)
    SELECT 'maintenance_enabled', value::text, NOW()
    FROM platform_settings
    WHERE key = 'maintenance_mode'
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

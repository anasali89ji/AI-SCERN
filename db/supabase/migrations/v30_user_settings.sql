-- v30_user_settings.sql
-- Real backing store for the Settings page. Previously the page only
-- persisted to localStorage (device-local, wiped on browser/cache clear)
-- and wrote 2 of ~18 fields to `profiles`, which never actually had those
-- columns migrated in. `/api/user/settings` returned hardcoded defaults
-- and never wrote anywhere. This is why settings didn't persist or load
-- per-user across devices.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id     TEXT PRIMARY KEY,           -- Clerk user id, not a Supabase auth uid
  settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings (updated_at);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Auth is handled entirely by Clerk (see lib/supabase/server.ts), so RLS
-- here only needs to block the anon/authenticated keys from touching this
-- table directly. All reads/writes go through the service-role admin
-- client in app/api/user/settings/route.ts after a Clerk auth check.
DROP POLICY IF EXISTS "user_settings_service_only" ON user_settings;
CREATE POLICY "user_settings_service_only" ON user_settings
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Keep updated_at accurate on every write.
CREATE OR REPLACE FUNCTION touch_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION touch_user_settings_updated_at();

-- =============================================================================
-- Aiscern v17 — User Settings Persistence (Module F)
-- Run in Supabase SQL Editor (service role).
--
-- Creates `user_settings` table with RLS, matching patterns from v10.
-- Stores all settings that previously lived only in localStorage.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id             TEXT        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notifications
  email_notif         BOOLEAN     NOT NULL DEFAULT true,
  batch_alerts        BOOLEAN     NOT NULL DEFAULT true,
  weekly_report       BOOLEAN     NOT NULL DEFAULT false,
  auto_save           BOOLEAN     NOT NULL DEFAULT true,
  upgrade_alerts      BOOLEAN     NOT NULL DEFAULT true,

  -- Detection prefs
  high_acc_mode       BOOLEAN     NOT NULL DEFAULT false,
  save_history        BOOLEAN     NOT NULL DEFAULT true,
  auto_download_pdf   BOOLEAN     NOT NULL DEFAULT false,
  show_confidence     BOOLEAN     NOT NULL DEFAULT true,
  show_signals        BOOLEAN     NOT NULL DEFAULT true,
  default_modality    TEXT        NOT NULL DEFAULT 'text'
                        CHECK (default_modality IN ('text','image','audio','video','url')),

  -- Privacy
  public_profile      BOOLEAN     NOT NULL DEFAULT false,
  share_anon          BOOLEAN     NOT NULL DEFAULT true,
  analytics_opt_out   BOOLEAN     NOT NULL DEFAULT false,
  data_retention_days INTEGER     NOT NULL DEFAULT 90
                        CHECK (data_retention_days IN (30, 90, 365, -1)),  -- -1 = forever

  -- Interface
  theme               TEXT        NOT NULL DEFAULT 'dark'
                        CHECK (theme IN ('dark', 'light', 'system')),
  language            TEXT        NOT NULL DEFAULT 'en'
                        CHECK (language IN ('en', 'ur', 'ar', 'es', 'fr')),
  compact_view        BOOLEAN     NOT NULL DEFAULT false,
  animations_off      BOOLEAN     NOT NULL DEFAULT false,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_settings"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid()::TEXT);

CREATE POLICY "users_insert_own_settings"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid()::TEXT);

CREATE POLICY "users_update_own_settings"
  ON user_settings FOR UPDATE
  USING (user_id = auth.uid()::TEXT);

CREATE POLICY "service_role_all_settings"
  ON user_settings FOR ALL
  USING (TRUE);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_user_settings_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- user_id is already the PK (= indexed). No additional indexes needed.

-- ── Migrate profiles.public_profile + analytics_opt_out ──────────────────────
-- Back-fill user_settings rows for any existing profiles that already have
-- these two boolean columns (the only two previously persisted to Supabase).
-- This is best-effort (profiles may not have these columns in all environments).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'public_profile'
  ) THEN
    INSERT INTO user_settings (user_id, public_profile, analytics_opt_out)
    SELECT id,
           COALESCE(public_profile, false),
           COALESCE(analytics_opt_out, false)
    FROM   profiles
    WHERE  id IS NOT NULL
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;
GRANT ALL ON user_settings TO service_role;

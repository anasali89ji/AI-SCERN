-- ════════════════════════════════════════════════════════════════════════════
-- Module 9 — Admin schema repair + subscription expiry system
--
-- Adds missing columns that the admin code reads/writes but no migration
-- created. Adds plan_expires_at enforcement (pg_cron auto-downgrade).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Missing admin columns on profiles ─────────────────────────────────────
-- These columns are referenced by frontend/app/api/admin/users/route.ts
-- and admin/users/page.tsx but were never created by any migration.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_granted_by   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_granted_at   TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at   TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned         BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_access  BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_revoked_at    TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_revoked_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS scan_count        INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_scans     INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_scans       INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_reset_at     TIMESTAMPTZ DEFAULT NOW();

-- ── 2. Index for plan expiry lookups ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires_at
  ON profiles(plan_expires_at) WHERE plan_expires_at IS NOT NULL;

-- ── 3. Auto-downgrade expired plans ─────────────────────────────────────────
-- This function checks all profiles where plan_expires_at < NOW() and
-- downgrades them to 'free'. Called by pg_cron every hour.
CREATE OR REPLACE FUNCTION downgrade_expired_plans()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE profiles
  SET plan = 'free',
      plan_id = 'free',
      plan_updated_at = NOW(),
      plan_expires_at = NULL,
      credits_balance = 0,
      credits_remaining = GREATEST(credits_remaining, 10)  -- keep at least free tier daily scans
  WHERE plan != 'free'
    AND plan_expires_at IS NOT NULL
    AND plan_expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule the auto-downgrade (runs at minute 0 of every hour)
-- Requires pg_cron extension (already enabled in v10)
SELECT cron.schedule(
  'downgrade-expired-plans',
  '0 * * * *',
  $$SELECT downgrade_expired_plans()$$
);

-- ── 4. Update check_and_increment_scan to enforce plan expiry inline ─────────
-- Also auto-downgrades if plan_expires_at < NOW() before checking daily limits.
-- This is a belt-and-suspenders approach: even if the cron hasn't run yet,
-- the scan will see the correct plan.
CREATE OR REPLACE FUNCTION check_and_increment_scan(p_user_id TEXT, p_media_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan            TEXT;
  v_daily_limit     INTEGER;
  v_credits_incl    INTEGER;
  v_daily_count     INTEGER;
  v_expires_at      TIMESTAMPTZ;
  v_downgraded      BOOLEAN := FALSE;
  v_modalities      TEXT[];
  v_overage         BOOLEAN;
  v_credits_bal     INTEGER;
  v_credits_rem     INTEGER;
  v_period_end      TIMESTAMPTZ;
BEGIN
  -- Ensure profile exists
  INSERT INTO profiles (id, plan, plan_id, credits_balance, credits_remaining, plan_updated_at)
  VALUES (p_user_id, 'free', 'free', 0, 9999, NOW())
  ON CONFLICT (id) DO NOTHING;

  SELECT plan, plan_expires_at INTO v_plan, v_expires_at
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  -- Auto-downgrade if plan expired (inline check — cron is the backup)
  IF v_plan != 'free' AND v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    UPDATE profiles
    SET plan = 'free', plan_id = 'free', plan_updated_at = NOW(),
        plan_expires_at = NULL, credits_balance = 0
    WHERE id = p_user_id;
    v_plan := 'free';
    v_downgraded := TRUE;
  END IF;

  -- Get plan limits
  SELECT daily_scans, credits_included, modalities, overage_allowed
  INTO v_daily_limit, v_credits_incl, v_modalities, v_overage
  FROM plan_limits WHERE plan = v_plan;

  IF v_daily_limit IS NULL THEN
    v_daily_limit := 10;
    v_credits_incl := 0;
    v_modalities := ARRAY['text', 'image'];
    v_overage := FALSE;
  END IF;

  -- Check modality access
  IF NOT (p_media_type = ANY(v_modalities)) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'modality_locked',
      'plan', v_plan,
      'modalities', v_modalities,
      'downgraded', v_downgraded
    );
  END IF;

  -- Get/update daily count
  SELECT daily_count INTO v_daily_count
  FROM user_scan_counts
  WHERE user_id = p_user_id AND scan_date = CURRENT_DATE
  FOR UPDATE;

  IF v_daily_count IS NULL THEN v_daily_count := 0; END IF;

  IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'plan', v_plan,
      'daily_scans', v_daily_count,
      'daily_limit', v_daily_limit,
      'downgraded', v_downgraded
    );
  END IF;

  -- Increment
  INSERT INTO user_scan_counts (user_id, scan_date, daily_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, scan_date)
  DO UPDATE SET daily_count = user_scan_counts.daily_count + 1;

  -- Get credits
  SELECT credits_balance, credits_remaining, credit_period_end
  INTO v_credits_bal, v_credits_rem, v_period_end
  FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'ok',
    'plan', v_plan,
    'daily_scans', v_daily_count + 1,
    'daily_limit', v_daily_limit,
    'credits_remaining', v_credits_rem,
    'credits_balance', v_credits_bal,
    'credit_period_end', v_period_end,
    'downgraded', v_downgraded
  );
END;
$$;

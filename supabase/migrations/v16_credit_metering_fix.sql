-- =============================================================================
-- Aiscern v16 — Credit Metering Fix (Module G) — v3 SELF-CONTAINED
-- Run in Supabase SQL Editor (service role). Safe to re-run.
--
-- This revision is fully self-contained: it creates plan_limits and
-- user_scan_counts if they don't already exist, so it works whether or not
-- v10_credits_and_billing.sql was previously run.
-- =============================================================================

-- ── STEP 1: Ensure plan_limits table exists ──────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_limits (
  plan             TEXT PRIMARY KEY,
  daily_scans      INTEGER NOT NULL DEFAULT 10,
  credits_included INTEGER NOT NULL DEFAULT 0,
  modalities       TEXT[]  NOT NULL DEFAULT ARRAY['text','image'],
  overage_allowed  BOOLEAN NOT NULL DEFAULT false,
  credits_per_scan INTEGER NOT NULL DEFAULT 1
);

-- Seed / update all four plans
INSERT INTO plan_limits (plan, daily_scans, credits_included, modalities, overage_allowed, credits_per_scan) VALUES
  ('free',       10,   0,    ARRAY['text','image'],                              false, 1),
  ('starter',    100,  100,  ARRAY['text','image','audio','video','url'],         false, 1),
  ('pro',        200,  500,  ARRAY['text','image','audio','video','url','batch'], true,  1),
  ('enterprise', -1,   9999, ARRAY['text','image','audio','video','url','batch'], true,  1)
ON CONFLICT (plan) DO UPDATE SET
  daily_scans      = EXCLUDED.daily_scans,
  credits_included = EXCLUDED.credits_included,
  modalities       = EXCLUDED.modalities,
  overage_allowed  = EXCLUDED.overage_allowed,
  credits_per_scan = EXCLUDED.credits_per_scan;

-- ── STEP 2: Ensure user_scan_counts table exists ─────────────────────────────
CREATE TABLE IF NOT EXISTS user_scan_counts (
  user_id     TEXT        NOT NULL,
  scan_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  daily_count INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_scan_counts_date ON user_scan_counts(scan_date);

-- ── STEP 3: Ensure credits_balance column exists on profiles ─────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credits_balance  INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_remaining INTEGER,
  ADD COLUMN IF NOT EXISTS plan_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_period_end   TIMESTAMPTZ;

-- ── STEP 4: Backfill billing-period for existing paid users ──────────────────
UPDATE profiles
SET    credit_period_start = COALESCE(plan_updated_at, NOW()),
       credit_period_end   = COALESCE(plan_updated_at, NOW()) + INTERVAL '1 month'
WHERE  plan != 'free'
  AND  credit_period_end IS NULL;

-- ── STEP 5: Drop old function with CASCADE ───────────────────────────────────
-- Required because we are changing the RETURNS TABLE signature (6 → 8 columns).
-- CREATE OR REPLACE cannot change return type — DROP first.
DROP FUNCTION IF EXISTS check_and_increment_scan(TEXT, TEXT) CASCADE;

-- ── STEP 6: Create new function ──────────────────────────────────────────────
CREATE FUNCTION check_and_increment_scan(
  p_user_id    TEXT,
  p_media_type TEXT
)
RETURNS TABLE(
  allowed            BOOLEAN,
  reason             TEXT,
  plan               TEXT,
  daily_scans        INTEGER,
  daily_limit        INTEGER,
  upgrade_required   BOOLEAN,
  credits_remaining  INTEGER,
  credit_period_end  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan              TEXT;
  v_credits           INTEGER;
  v_daily_count       INTEGER;
  v_daily_limit       INTEGER;
  v_modalities        TEXT[];
  v_credits_cost      INTEGER := 1;
  v_credit_period_end TIMESTAMPTZ;
BEGIN
  -- Fetch user profile (row-locked to prevent race conditions)
  SELECT p.plan,
         COALESCE(p.credits_balance, 0),
         p.credit_period_end
  INTO   v_plan, v_credits, v_credit_period_end
  FROM   profiles p
  WHERE  p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'user_not_found'::TEXT, 'free'::TEXT, 0, 10, true, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Fetch plan limits
  SELECT pl.daily_scans, pl.modalities, pl.credits_per_scan
  INTO   v_daily_limit, v_modalities, v_credits_cost
  FROM   plan_limits pl
  WHERE  pl.plan = v_plan;

  IF NOT FOUND THEN
    v_plan         := 'free';
    v_daily_limit  := 10;
    v_modalities   := ARRAY['text','image'];
    v_credits_cost := 1;
  END IF;

  -- Modality access check
  IF NOT (p_media_type = ANY(v_modalities)) THEN
    RETURN QUERY SELECT false, 'modality_not_included'::TEXT, v_plan, 0, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- Ensure today's row exists
  INSERT INTO user_scan_counts(user_id, scan_date, daily_count)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, scan_date) DO NOTHING;

  SELECT daily_count INTO v_daily_count
  FROM   user_scan_counts
  WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE
  FOR UPDATE;

  -- FREE PLAN: daily limit only
  IF v_plan = 'free' THEN
    IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
      RETURN QUERY SELECT false, 'daily_limit_reached'::TEXT, v_plan, v_daily_count, v_daily_limit, true, 0, NULL::TIMESTAMPTZ;
      RETURN;
    END IF;

    UPDATE user_scan_counts
    SET    daily_count = daily_count + 1, updated_at = NOW()
    WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE;

    RETURN QUERY SELECT true, 'allowed'::TEXT, v_plan, v_daily_count + 1, v_daily_limit, false, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- PAID PLANS: credits_balance is the primary quota

  -- Primary check: enough credits?
  IF v_credits < v_credits_cost THEN
    RETURN QUERY SELECT false, 'modality_credits_exhausted'::TEXT, v_plan, v_daily_count, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- Secondary check: anti-abuse daily throttle (-1 = unlimited)
  IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
    RETURN QUERY SELECT false, 'daily_limit_reached'::TEXT, v_plan, v_daily_count, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- All checks passed — decrement credits and increment daily count
  UPDATE profiles
  SET    credits_balance = GREATEST(0, credits_balance - v_credits_cost)
  WHERE  id = p_user_id
  RETURNING credits_balance INTO v_credits;

  UPDATE user_scan_counts
  SET    daily_count = daily_count + 1, updated_at = NOW()
  WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE;

  RETURN QUERY SELECT true, 'allowed'::TEXT, v_plan, v_daily_count + 1, v_daily_limit, false, v_credits, v_credit_period_end;
END;
$$;

-- ── STEP 7: Restore grants ───────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO authenticated;

-- ── STEP 8: Enable RLS on new tables if not already set ─────────────────────
ALTER TABLE plan_limits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scan_counts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plan_limits' AND policyname = 'Public read plan_limits'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read plan_limits" ON plan_limits FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_scan_counts' AND policyname = 'Users read own scan counts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users read own scan counts" ON user_scan_counts FOR SELECT USING (auth.uid()::text = user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_scan_counts' AND policyname = 'Service write scan counts'
  ) THEN
    EXECUTE 'CREATE POLICY "Service write scan counts" ON user_scan_counts FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── STEP 9: Sanity check ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_plan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_plan_count FROM plan_limits;
  RAISE NOTICE 'v16 migration complete — plan_limits has % rows, check_and_increment_scan() recreated with 8-column return type', v_plan_count;
END;
$$;

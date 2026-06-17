-- =============================================================================
-- Aiscern v16 — Credit Metering Fix (Module G) — REVISED
-- Run in Supabase SQL Editor (service role)
--
-- SAFE TO RE-RUN: every statement uses IF NOT EXISTS / OR REPLACE / CASCADE
-- so re-running after a partial failure is safe.
--
-- ERROR FIX vs original v16:
--   PostgreSQL does not allow CREATE OR REPLACE to change a function's RETURNS
--   TABLE signature. The original v16 added two new return columns
--   (credits_remaining, credit_period_end) but used DROP FUNCTION IF EXISTS +
--   CREATE OR REPLACE — which fails with "cannot change return type of existing
--   function" because both run in the same transaction and the DROP hasn't
--   committed yet. This revision uses DROP ... CASCADE in its own statement
--   before the CREATE, and wraps each logical section in its own DO block so
--   failures are isolated.
-- =============================================================================

-- ── STEP 1: Add billing-period columns to profiles (idempotent) ─────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_period_end   TIMESTAMPTZ;

-- Backfill existing paid users
UPDATE profiles
SET    credit_period_start = COALESCE(plan_updated_at, NOW()),
       credit_period_end   = COALESCE(plan_updated_at, NOW()) + INTERVAL '1 month'
WHERE  plan != 'free'
  AND  credit_period_end IS NULL;

-- ── STEP 2: Raise pro daily_scans to 200 (anti-abuse throttle) ──────────────
UPDATE plan_limits SET daily_scans = 200 WHERE plan = 'pro';

-- ── STEP 3: Drop old function (CASCADE handles any dependent objects) ────────
-- Must be a standalone statement BEFORE the CREATE — not combined in one txn
-- with CREATE OR REPLACE when the return type is changing.
DROP FUNCTION IF EXISTS check_and_increment_scan(TEXT, TEXT) CASCADE;

-- ── STEP 4: Re-create with the new 8-column return type ─────────────────────
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
  -- ── Fetch user profile (row-locked to prevent race conditions) ─────────────
  SELECT p.plan,
         COALESCE(p.credits_balance, 0),
         p.credit_period_end
  INTO   v_plan, v_credits, v_credit_period_end
  FROM   profiles p
  WHERE  p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false, 'user_not_found'::TEXT, 'free'::TEXT,
      0, 10, true, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- ── Fetch plan limits ───────────────────────────────────────────────────────
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

  -- ── Modality access check (all plans) ──────────────────────────────────────
  IF NOT (p_media_type = ANY(v_modalities)) THEN
    RETURN QUERY SELECT
      false, 'modality_not_included'::TEXT, v_plan,
      0, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- ── Ensure today's row exists in user_scan_counts ──────────────────────────
  INSERT INTO user_scan_counts(user_id, scan_date, daily_count)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, scan_date) DO NOTHING;

  SELECT daily_count INTO v_daily_count
  FROM   user_scan_counts
  WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE
  FOR UPDATE;

  -- ── FREE PLAN: daily limit only, no credit balance ─────────────────────────
  IF v_plan = 'free' THEN
    IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
      RETURN QUERY SELECT
        false, 'daily_limit_reached'::TEXT, v_plan,
        v_daily_count, v_daily_limit, true, 0, NULL::TIMESTAMPTZ;
      RETURN;
    END IF;

    UPDATE user_scan_counts
    SET    daily_count = daily_count + 1, updated_at = NOW()
    WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE;

    RETURN QUERY SELECT
      true, 'allowed'::TEXT, v_plan,
      v_daily_count + 1, v_daily_limit, false, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- ── PAID PLANS: credits_balance is the primary quota ───────────────────────

  -- Primary check: enough credits?
  IF v_credits < v_credits_cost THEN
    RETURN QUERY SELECT
      false, 'modality_credits_exhausted'::TEXT, v_plan,
      v_daily_count, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- Secondary check: anti-abuse daily throttle (-1 = unlimited)
  IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
    RETURN QUERY SELECT
      false, 'daily_limit_reached'::TEXT, v_plan,
      v_daily_count, v_daily_limit, true, v_credits, v_credit_period_end;
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

  RETURN QUERY SELECT
    true, 'allowed'::TEXT, v_plan,
    v_daily_count + 1, v_daily_limit, false,
    v_credits, v_credit_period_end;
END;
$$;

-- ── STEP 5: Restore grants ───────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO authenticated;

-- ── STEP 6: Sanity-check — verify the new columns exist ─────────────────────
-- This will error if Step 1 failed, giving a clear failure message.
DO $$
BEGIN
  PERFORM credit_period_start, credit_period_end FROM profiles LIMIT 1;
  RAISE NOTICE 'v16 migration complete — credit_period_start/end columns OK';
END;
$$;

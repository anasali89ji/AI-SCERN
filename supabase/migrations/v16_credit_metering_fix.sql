-- =============================================================================
-- Aiscern v16 — Credit Metering Fix (Module G)
-- Run in Supabase SQL Editor (service role)
--
-- Problem being fixed (see CHANGES.md "Module G" for full diagnosis):
--   check_and_increment_scan() only ever decremented profiles.credits_balance
--   inside the "daily limit already hit" overage branch. Under normal usage
--   (daily_count never reaches daily_scans for a single user in one day),
--   credits_balance was NEVER decremented — it stayed pinned at whatever value
--   was set when the plan was granted, while user_scan_counts silently reset
--   to 0 every night via the 'reset-daily-scan-counts' cron. This made the
--   "Scan Credits" usage bar permanently show 0% used.
--
-- New model ("500 credits = 500 scans/month", as promised on /dashboard/credits):
--   - free:  unchanged — daily_scans-only, resets nightly, no credit balance.
--   - paid (starter/pro/enterprise):
--       1. credits_balance is the PRIMARY quota — checked + decremented on
--          EVERY successful scan, unconditionally.
--       2. daily_scans becomes a SECONDARY anti-abuse throttle (raised for
--          'pro' to 200/day so a script can't burn the entire 500-credit
--          monthly pool in a single sitting, while still being far above any
--          normal human's daily usage).
--       3. credits_balance only resets to credits_included on a genuine
--          renewal event (XPay webhook plan update or admin grant — see
--          frontend/app/api/webhook/xpay/route.ts and
--          admin/app/api/users/[id]/{plan,credits}/route.ts), never from the
--          nightly cron.
-- =============================================================================

-- ── 1. Add credit billing-period columns to profiles ───────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_period_end   TIMESTAMPTZ;

-- Backfill: for existing paid users, start the period at plan_updated_at
-- (or NOW() if never set) so the profile page can immediately show a
-- "Resets on <date>" instead of nothing.
UPDATE profiles
SET    credit_period_start = COALESCE(plan_updated_at, NOW()),
       credit_period_end   = COALESCE(plan_updated_at, NOW()) + INTERVAL '1 month'
WHERE  plan != 'free'
  AND  credit_period_end IS NULL;

-- ── 2. Anti-abuse daily throttle for 'pro' ──────────────────────────────────
-- Was 500/day (== the entire monthly credit pool, i.e. no real throttle at
-- all). 200/day is far above normal human usage but prevents a single-day
-- script from burning the whole month's allocation.
UPDATE plan_limits SET daily_scans = 200 WHERE plan = 'pro';

-- ── 3. Rewrite check_and_increment_scan() — credits_balance is now primary ─
-- New return columns: credits_remaining, credit_period_end (so credit-guard
-- and /api/user/credits can read both from a single RPC call).
DROP FUNCTION IF EXISTS check_and_increment_scan(TEXT, TEXT);

CREATE OR REPLACE FUNCTION check_and_increment_scan(
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
  -- Fetch user profile
  SELECT p.plan, p.credits_balance, p.credit_period_end
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
    -- Unknown plan → treat as free
    v_plan         := 'free';
    v_daily_limit  := 10;
    v_modalities   := ARRAY['text','image'];
    v_credits_cost := 1;
  END IF;

  -- Check modality access (applies to all plans, including free)
  IF NOT (p_media_type = ANY(v_modalities)) THEN
    RETURN QUERY SELECT false, 'modality_not_included'::TEXT, v_plan, 0, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- Get/create today's scan count
  INSERT INTO user_scan_counts(user_id, scan_date, daily_count)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, scan_date) DO NOTHING;

  SELECT daily_count INTO v_daily_count
  FROM   user_scan_counts
  WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE
  FOR UPDATE;

  -- ── FREE PLAN: daily-limit-only, no credit balance ─────────────────────────
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

  -- ── PAID PLANS: credits_balance is the primary quota ───────────────────────

  -- 1. Primary check — do they have credits for this scan?
  IF v_credits < v_credits_cost THEN
    RETURN QUERY SELECT false, 'modality_credits_exhausted'::TEXT, v_plan, v_daily_count, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- 2. Secondary check — anti-abuse daily throttle (-1 = unlimited, e.g. enterprise)
  IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
    RETURN QUERY SELECT false, 'daily_limit_reached'::TEXT, v_plan, v_daily_count, v_daily_limit, true, v_credits, v_credit_period_end;
    RETURN;
  END IF;

  -- All checks passed — decrement credits_balance AND increment daily_count
  UPDATE profiles
  SET    credits_balance = GREATEST(0, credits_balance - v_credits_cost)
  WHERE  id = p_user_id
  RETURNING credits_balance INTO v_credits;

  UPDATE user_scan_counts
  SET    daily_count = daily_count + 1, updated_at = NOW()
  WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE;

  RETURN QUERY SELECT
    true,
    'allowed'::TEXT,
    v_plan,
    v_daily_count + 1,
    v_daily_limit,
    false,
    v_credits,
    v_credit_period_end;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO authenticated;

-- ── 4. Confirm no other cron job touches credits_balance/credits_remaining ──
-- (Audited: the only cron in supabase/migrations/*.sql is
--  'reset-daily-scan-counts' from v10, which only DELETEs from
--  user_scan_counts. No cron resets credit balances. Nothing to remove here —
--  this comment documents that the audit was performed.)

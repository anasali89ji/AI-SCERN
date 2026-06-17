-- =============================================================================
-- Aiscern v19 — Credit Guard Fix
-- Run in Supabase SQL Editor (service role). Safe to re-run.
--
-- Fixes:
--  1. Replaces check_and_increment_scan() with a RETURNS JSONB version so
--     the Supabase JS client receives a plain object (not an array), making
--     it impossible to hit the array-vs-object bug in credit-guard.ts.
--     (Root cause of "limit reached on new accounts".)
--  2. Auto-creates a free profile inside the function if user_not_found,
--     so first-scan race conditions (Clerk → redirect → scan before profile
--     sync completes) never block a legitimate user.
--  3. Ensures plan_limits rows exist (idempotent seed).
--  4. Ensures credits_balance column exists on profiles (safe ALTER).
-- =============================================================================

-- ── 1. Ensure required columns on profiles ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credits_balance     INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_remaining   INTEGER,
  ADD COLUMN IF NOT EXISTS plan_updated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_period_end   TIMESTAMPTZ;

-- ── 2. Ensure plan_limits exists and has correct rows ────────────────────────
CREATE TABLE IF NOT EXISTS plan_limits (
  plan             TEXT PRIMARY KEY,
  daily_scans      INTEGER NOT NULL DEFAULT 10,
  credits_included INTEGER NOT NULL DEFAULT 0,
  modalities       TEXT[]  NOT NULL DEFAULT ARRAY['text','image'],
  overage_allowed  BOOLEAN NOT NULL DEFAULT false,
  credits_per_scan INTEGER NOT NULL DEFAULT 1
);

INSERT INTO plan_limits (plan, daily_scans, credits_included, modalities, overage_allowed, credits_per_scan)
VALUES
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

-- ── 3. Ensure user_scan_counts exists ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_scan_counts (
  user_id     TEXT        NOT NULL,
  scan_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  daily_count INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, scan_date)
);
CREATE INDEX IF NOT EXISTS idx_scan_counts_date ON user_scan_counts(scan_date);

-- ── 4. Drop old RETURNS TABLE version (signature change requires DROP) ────────
DROP FUNCTION IF EXISTS check_and_increment_scan(TEXT, TEXT) CASCADE;

-- ── 5. New function — RETURNS JSONB (plain object, never an array) ────────────
--
-- Why JSONB instead of RETURNS TABLE?
--   Supabase JS .rpc() wraps RETURNS TABLE functions in an array even when
--   the function returns exactly one row. Application code must then do
--   data[0] to get the result — easy to miss, was the root cause of the bug.
--   RETURNS JSONB always gives a plain object: no array unwrapping needed.
--
CREATE FUNCTION check_and_increment_scan(
  p_user_id    TEXT,
  p_media_type TEXT
)
RETURNS JSONB
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

  -- AUTO-CREATE profile for race condition (Clerk redirect before sync)
  IF NOT FOUND THEN
    INSERT INTO profiles (id, plan, plan_id, credits_balance, scan_count, monthly_scans, created_at, updated_at)
    VALUES (p_user_id, 'free', 'free', 0, 0, 0, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    RETURN jsonb_build_object(
      'allowed',           true,
      'reason',            'auto_created',
      'plan',              'free',
      'daily_scans',       1,
      'daily_limit',       10,
      'upgrade_required',  false,
      'credits_remaining', 0,
      'credit_period_end', NULL
    );
  END IF;

  -- Fetch plan limits
  SELECT pl.daily_scans, pl.modalities, pl.credits_per_scan
  INTO   v_daily_limit, v_modalities, v_credits_cost
  FROM   plan_limits pl
  WHERE  pl.plan = v_plan;

  -- Fallback for unknown plan
  IF NOT FOUND THEN
    v_plan         := 'free';
    v_daily_limit  := 10;
    v_modalities   := ARRAY['text','image'];
    v_credits_cost := 1;
  END IF;

  -- Modality access check
  IF NOT (p_media_type = ANY(v_modalities)) THEN
    RETURN jsonb_build_object(
      'allowed',           false,
      'reason',            'modality_not_included',
      'plan',              v_plan,
      'daily_scans',       0,
      'daily_limit',       v_daily_limit,
      'upgrade_required',  true,
      'credits_remaining', v_credits,
      'credit_period_end', v_credit_period_end
    );
  END IF;

  -- Ensure today's row exists
  INSERT INTO user_scan_counts(user_id, scan_date, daily_count)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, scan_date) DO NOTHING;

  SELECT daily_count INTO v_daily_count
  FROM   user_scan_counts
  WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE
  FOR UPDATE;

  -- ── FREE PLAN: daily limit only ──────────────────────────────────────────
  IF v_plan = 'free' THEN
    IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
      RETURN jsonb_build_object(
        'allowed',           false,
        'reason',            'daily_limit_reached',
        'plan',              v_plan,
        'daily_scans',       v_daily_count,
        'daily_limit',       v_daily_limit,
        'upgrade_required',  true,
        'credits_remaining', 0,
        'credit_period_end', NULL
      );
    END IF;

    UPDATE user_scan_counts
    SET    daily_count = daily_count + 1, updated_at = NOW()
    WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE;

    RETURN jsonb_build_object(
      'allowed',           true,
      'reason',            'allowed',
      'plan',              v_plan,
      'daily_scans',       v_daily_count + 1,
      'daily_limit',       v_daily_limit,
      'upgrade_required',  false,
      'credits_remaining', 0,
      'credit_period_end', NULL
    );
  END IF;

  -- ── PAID PLANS: credits_balance is the primary quota ─────────────────────

  IF v_credits < v_credits_cost THEN
    RETURN jsonb_build_object(
      'allowed',           false,
      'reason',            'modality_credits_exhausted',
      'plan',              v_plan,
      'daily_scans',       v_daily_count,
      'daily_limit',       v_daily_limit,
      'upgrade_required',  true,
      'credits_remaining', v_credits,
      'credit_period_end', v_credit_period_end
    );
  END IF;

  IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed',           false,
      'reason',            'daily_limit_reached',
      'plan',              v_plan,
      'daily_scans',       v_daily_count,
      'daily_limit',       v_daily_limit,
      'upgrade_required',  true,
      'credits_remaining', v_credits,
      'credit_period_end', v_credit_period_end
    );
  END IF;

  -- All checks passed — decrement credits and increment daily count
  UPDATE profiles
  SET    credits_balance = GREATEST(0, credits_balance - v_credits_cost),
         updated_at      = NOW()
  WHERE  id = p_user_id
  RETURNING credits_balance INTO v_credits;

  UPDATE user_scan_counts
  SET    daily_count = daily_count + 1, updated_at = NOW()
  WHERE  user_id = p_user_id AND scan_date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'allowed',           true,
    'reason',            'allowed',
    'plan',              v_plan,
    'daily_scans',       v_daily_count + 1,
    'daily_limit',       v_daily_limit,
    'upgrade_required',  false,
    'credits_remaining', v_credits,
    'credit_period_end', v_credit_period_end
  );
END;
$$;

-- ── 6. Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_scan(TEXT, TEXT) TO authenticated;

-- ── 7. RLS on helper tables ───────────────────────────────────────────────────
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

-- ── 8. Update credit-guard.ts note in DB (stored as a comment) ────────────────
COMMENT ON FUNCTION check_and_increment_scan(TEXT, TEXT) IS
  'v19: RETURNS JSONB (not TABLE) so Supabase .rpc() returns a plain object. '
  'Auto-creates free profile if user_not_found. Atomic via FOR UPDATE.';

-- ── 9. Sanity check ───────────────────────────────────────────────────────────
DO $$
DECLARE v_plan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_plan_count FROM plan_limits;
  RAISE NOTICE 'v19 migration complete — plan_limits has % rows, check_and_increment_scan() now RETURNS JSONB', v_plan_count;
END;
$$;

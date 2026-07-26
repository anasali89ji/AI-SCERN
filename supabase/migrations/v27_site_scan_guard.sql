-- v27_site_scan_guard.sql
-- The Web Scanner (/scraper -> /api/scanner) had NO auth check and NO credit
-- guard at all — anyone, signed in or not, could hit it with unlimited
-- requests (only a 5-per-*minute*-per-IP in-memory limiter, reset on every
-- deploy). This adds a proper per-account, per-day counter dedicated to site
-- scans so it doesn't share/interfere with the general scan quota used by
-- check_and_increment_scan(), and gives free accounts exactly 5 scans/day
-- as intended.

CREATE TABLE IF NOT EXISTS user_site_scan_counts (
  user_id     TEXT        NOT NULL,
  scan_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  daily_count INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, scan_date)
);
CREATE INDEX IF NOT EXISTS idx_site_scan_counts_date ON user_site_scan_counts(scan_date);

CREATE OR REPLACE FUNCTION check_and_increment_site_scan(
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan        TEXT;
  v_daily_limit INTEGER;
  v_daily_count INTEGER;
BEGIN
  SELECT p.plan INTO v_plan FROM profiles p WHERE p.id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO profiles (id, plan, plan_id, credits_balance, scan_count, monthly_scans, created_at, updated_at)
    VALUES (p_user_id, 'free', 'free', 0, 0, 0, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    v_plan := 'free';
  END IF;

  -- Web Scanner daily allowance per plan — independent of the general
  -- text/image/audio/video daily_scans counter.
  v_daily_limit := CASE v_plan
    WHEN 'free'       THEN 5
    WHEN 'starter'    THEN 25
    WHEN 'pro'        THEN 100
    WHEN 'enterprise' THEN -1
    ELSE 5
  END;

  INSERT INTO user_site_scan_counts (user_id, scan_date, daily_count)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, scan_date) DO NOTHING;

  SELECT daily_count INTO v_daily_count
  FROM user_site_scan_counts
  WHERE user_id = p_user_id AND scan_date = CURRENT_DATE
  FOR UPDATE;

  IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed',     false,
      'reason',      'daily_limit_reached',
      'plan',        v_plan,
      'daily_scans', v_daily_count,
      'daily_limit', v_daily_limit
    );
  END IF;

  UPDATE user_site_scan_counts
  SET daily_count = daily_count + 1, updated_at = NOW()
  WHERE user_id = p_user_id AND scan_date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'allowed',     true,
    'reason',      'allowed',
    'plan',        v_plan,
    'daily_scans', v_daily_count + 1,
    'daily_limit', v_daily_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_increment_site_scan(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_site_scan(TEXT) TO authenticated;

ALTER TABLE user_site_scan_counts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_site_scan_counts' AND policyname = 'Users read own site scan counts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users read own site scan counts" ON user_site_scan_counts FOR SELECT USING (auth.uid()::text = user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_site_scan_counts' AND policyname = 'Service write site scan counts'
  ) THEN
    EXECUTE 'CREATE POLICY "Service write site scan counts" ON user_site_scan_counts FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

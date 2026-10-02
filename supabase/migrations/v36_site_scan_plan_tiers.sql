-- ════════════════════════════════════════════════════════════════════════════
-- Module 4.7 — Add max_pages_per_scan + max_images_per_scan to site_scan_guard
--
-- v27_site_scan_guard.sql had per-plan daily scan COUNT caps (free=5,
-- starter=25, pro=100, enterprise=-1) but NO max_pages_per_scan column.
-- The RPC only counts scans/day, not pages-per-scan — the server couldn't
-- enforce "Pro = 500 pages per scan".
--
-- This migration adds the per-plan page/image caps to the RPC return value.
-- The application code (frontend/lib/middleware/site-scan-guard.ts) reads
-- these and clamps body.maxPages/maxImagesTotal accordingly.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Update the RPC to also return max_pages_per_scan + max_images_per_scan ──
-- We need to modify check_and_increment_site_scan() to include the new fields.
-- Since we can't easily ALTER an existing function, we DROP and RECREATE it.

CREATE OR REPLACE FUNCTION check_and_increment_site_scan(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan        TEXT;
  v_daily_limit INTEGER;
  v_daily_count INTEGER;
  v_max_pages   INTEGER;
  v_max_images  INTEGER;
BEGIN
  SELECT p.plan INTO v_plan FROM profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF v_plan IS NULL THEN
    v_plan := 'free';
  END IF;

  v_daily_limit := CASE v_plan
    WHEN 'free'       THEN 5
    WHEN 'starter'    THEN 25
    WHEN 'pro'        THEN 100
    WHEN 'enterprise' THEN -1  -- unlimited
    ELSE 5
  END;

  -- Module 4.7: per-plan max pages/images per scan
  v_max_pages := CASE v_plan
    WHEN 'free'       THEN 30
    WHEN 'starter'    THEN 150
    WHEN 'pro'        THEN 500
    WHEN 'enterprise' THEN 5000
    ELSE 30
  END;

  v_max_images := CASE v_plan
    WHEN 'free'       THEN 40
    WHEN 'starter'    THEN 100
    WHEN 'pro'        THEN 150
    WHEN 'enterprise' THEN 500
    ELSE 40
  END;

  SELECT daily_count INTO v_daily_count
  FROM site_scan_usage
  WHERE user_id = p_user_id AND scan_date = CURRENT_DATE
  FOR UPDATE;

  IF v_daily_count IS NULL THEN
    v_daily_count := 0;
  END IF;

  IF v_daily_limit != -1 AND v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'plan', v_plan,
      'daily_scans', v_daily_count,
      'daily_limit', v_daily_limit,
      'max_pages_per_scan', v_max_pages,
      'max_images_per_scan', v_max_images
    );
  END IF;

  -- Increment
  INSERT INTO site_scan_usage (user_id, scan_date, daily_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, scan_date)
  DO UPDATE SET daily_count = site_scan_usage.daily_count + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'ok',
    'plan', v_plan,
    'daily_scans', v_daily_count + 1,
    'daily_limit', v_daily_limit,
    'max_pages_per_scan', v_max_pages,
    'max_images_per_scan', v_max_images
  );
END;
$$;

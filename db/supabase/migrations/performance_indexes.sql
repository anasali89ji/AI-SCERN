-- ═══════════════════════════════════════════════════════════════
-- Aiscern — Supabase Performance Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Composite index for scan history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_user_created
  ON scans(user_id, created_at DESC);

-- 2. Composite index for dashboard analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_user_verdict_created
  ON scans(user_id, verdict, created_at DESC);

-- 3. Index for admin queries by media type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_media_type_created
  ON scans(media_type, created_at DESC);

-- 4. Index for confidence score range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_confidence
  ON scans(confidence_score DESC) WHERE confidence_score IS NOT NULL;

-- 5. Partial index for incomplete scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_incomplete
  ON scans(user_id, created_at) WHERE status IN ('pending', 'processing');

-- 6. Rate limit table (Supabase fallback for Upstash)
CREATE TABLE IF NOT EXISTS rate_limits (
  ip           text        NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (ip)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip);

-- Rate limit RPC function
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_ip             text,
  p_max            integer DEFAULT 20,
  p_window_minutes integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
  v_start timestamptz;
BEGIN
  SELECT count, window_start INTO v_count, v_start FROM rate_limits WHERE ip = p_ip;
  IF NOT FOUND OR now() > v_start + (p_window_minutes || ' minutes')::interval THEN
    INSERT INTO rate_limits (ip, window_start, count) VALUES (p_ip, now(), 1)
    ON CONFLICT (ip) DO UPDATE SET window_start = now(), count = 1;
    RETURN true;
  END IF;
  IF v_count >= p_max THEN RETURN false; END IF;
  UPDATE rate_limits SET count = count + 1 WHERE ip = p_ip;
  RETURN true;
END;
$$;

-- 7. User stats RPC
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id text)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total_scans',    COUNT(*),
    'ai_detected',    COUNT(*) FILTER (WHERE verdict = 'AI'),
    'human_detected', COUNT(*) FILTER (WHERE verdict = 'HUMAN'),
    'uncertain',      COUNT(*) FILTER (WHERE verdict = 'UNCERTAIN'),
    'avg_confidence', COALESCE(AVG(confidence_score), 0),
    'image_scans',    COUNT(*) FILTER (WHERE media_type = 'image'),
    'video_scans',    COUNT(*) FILTER (WHERE media_type = 'video'),
    'audio_scans',    COUNT(*) FILTER (WHERE media_type = 'audio'),
    'text_scans',     COUNT(*) FILTER (WHERE media_type = 'text')
  ) FROM scans WHERE user_id = p_user_id AND status = 'complete';
$$;

-- 8. Increment scan count RPC (used by Inngest onScanCompleted)
CREATE OR REPLACE FUNCTION increment_scan_count(
  p_user_id    text,
  p_media_type text DEFAULT 'text'
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET
    scan_count    = scan_count + 1,
    monthly_scans = monthly_scans + 1,
    updated_at    = now()
  WHERE id = p_user_id;
$$;

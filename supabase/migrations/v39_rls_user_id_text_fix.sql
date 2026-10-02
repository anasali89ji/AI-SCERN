-- ════════════════════════════════════════════════════════════════════════════
-- Module 5.7 — Fix RLS auth.uid() type mismatch (UUID vs TEXT)
--
-- rls_hardening.sql:49 uses `auth.uid() = user_id` but auth.uid() returns
-- UUID while user_id is TEXT (Clerk IDs like 'user_2abc123def'). The
-- comparison is ALWAYS FALSE — any client-side Supabase query against
-- `scans` returns zero rows. Currently dormant because the app uses
-- service-role (bypasses RLS), but will explode the moment anyone adds
-- a client-side query.
--
-- Fix: cast auth.uid() to TEXT before comparison.
-- ════════════════════════════════════════════════════════════════════════════

-- Fix scans RLS policies (was: auth.uid() = user_id — UUID vs TEXT)
DROP POLICY IF EXISTS scans_select_own ON scans;
DROP POLICY IF EXISTS scans_insert_own ON scans;
DROP POLICY IF EXISTS scans_update_own ON scans;
DROP POLICY IF EXISTS scans_delete_own ON scans;

CREATE POLICY scans_select_own ON scans
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY scans_insert_own ON scans
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY scans_update_own ON scans
  FOR UPDATE USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY scans_delete_own ON scans
  FOR DELETE USING (auth.uid()::text = user_id);

-- Fix scan_feedback RLS policies (same UUID vs TEXT issue)
DROP POLICY IF EXISTS scan_feedback_select_own ON scan_feedback;
DROP POLICY IF EXISTS scan_feedback_insert_own ON scan_feedback;

CREATE POLICY scan_feedback_select_own ON scan_feedback
  FOR SELECT USING (auth.uid()::text = created_by);

CREATE POLICY scan_feedback_insert_own ON scan_feedback
  FOR INSERT WITH CHECK (auth.uid()::text = created_by);

-- Fix detection_embeddings RLS policies
DROP POLICY IF EXISTS detection_embeddings_select_own ON detection_embeddings;
CREATE POLICY detection_embeddings_select_own ON detection_embeddings
  FOR SELECT USING (auth.uid()::text = (
    SELECT user_id FROM scans WHERE scans.id = detection_embeddings.scan_id
  ));

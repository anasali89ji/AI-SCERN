-- v30_chat_token_usage.sql
-- Part of the ARIA tokenization/context-window upgrade (see
-- frontend/lib/aria/tokenizer.ts, frontend/lib/aria/context-window.ts).
--
-- Schema only, in this migration — chat/route.ts does not write to this
-- table yet. Per-request prompt/completion token counts are currently
-- computed and emitted over SSE (`{type: "usage", ...}`) plus logged to
-- console; wiring an insert into this table is the natural next step, but
-- needs the model-selection refactor in chat/route.ts's tryModel()/
-- raceFirstSuccess() to actually surface which model won the race before a
-- per-request cost can be attributed correctly. Shipping the table now so
-- that follow-up is additive, not another migration.

CREATE TABLE IF NOT EXISTS chat_token_usage (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  session_id        TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_token_usage_user    ON chat_token_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_token_usage_session ON chat_token_usage (session_id);

ALTER TABLE chat_token_usage ENABLE ROW LEVEL SECURITY;

-- Same pattern as chat_sessions/chat_messages (v26): all access goes through
-- the service-role key from server API routes, auth enforced there via Clerk.
DROP POLICY IF EXISTS "service role full access chat_token_usage" ON chat_token_usage;
CREATE POLICY "service role full access chat_token_usage" ON chat_token_usage
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

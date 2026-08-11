-- v26_chat_history.sql
-- ROOT CAUSE FIX: ARIA chat history was stored ONLY in browser localStorage
-- (frontend/app/(dashboard)/chat/page.tsx, key "aiscern_chats_v2"). That
-- storage is per-browser, not per-account, so the same Clerk account on
-- mobile vs. web (two different browsers/local storages) never shared any
-- history — nothing tied chats to the user server-side. This migration adds
-- the server-side store so history can sync across every device.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT PRIMARY KEY,                 -- client-generated chat id
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New chat',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,                 -- client-generated message id
  session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT NOT NULL DEFAULT '',
  attachments JSONB,
  tool_events JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  seq         BIGSERIAL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user   ON chat_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id, seq);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user    ON chat_messages (user_id);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- All access goes through the service-role key from server API routes
-- (auth is enforced there via Clerk's auth()), matching the pattern already
-- used by /api/user/credits and other routes in this codebase.
DROP POLICY IF EXISTS "service role full access sessions" ON chat_sessions;
CREATE POLICY "service role full access sessions" ON chat_sessions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service role full access messages" ON chat_messages;
CREATE POLICY "service role full access messages" ON chat_messages
  FOR ALL USING (true) WITH CHECK (true);

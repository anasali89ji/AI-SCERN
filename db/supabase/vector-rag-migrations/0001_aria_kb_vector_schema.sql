-- Applies to the SEPARATE "aiscern-vector-rag" Supabase project
-- (ref: rciimoimzifqgnrondyz, https://rciimoimzifqgnrondyz.supabase.co,
-- ap-southeast-1) — NOT the main detectai-v2 project. This file lives
-- outside supabase/migrations/ specifically so it doesn't get swept up in
-- `supabase db push` against the main project's linked database.
--
-- This was already applied directly (via Supabase's management API) when
-- the project was created — this file is the version-controlled record of
-- that schema, and how to re-apply it if the project is ever rebuilt.
--
-- To apply manually against the vector-rag project:
--   supabase db execute --db-url "postgresql://postgres:[password]@db.rciimoimzifqgnrondyz.supabase.co:5432/postgres" -f supabase/vector-rag-migrations/0001_aria_kb_vector_schema.sql
-- (get the DB password from https://supabase.com/dashboard/project/rciimoimzifqgnrondyz/settings/database)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS aria_kb_entries (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id    TEXT        NOT NULL UNIQUE,   -- matches aria-rag.ts KNOWLEDGE_BASE entry.id
  category    TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  source      TEXT,
  embedding   vector(384),                    -- sentence-transformers/all-MiniLM-L6-v2
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aria_kb_category ON aria_kb_entries(category);

-- IVFFlat ANN index — run manually once there are >= 100 rows (premature on
-- a ~35-entry, hand-curated KB; a sequential scan is already fast at this size):
-- CREATE INDEX ON aria_kb_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE OR REPLACE FUNCTION match_aria_kb_entries(
  query_embedding vector(384),
  match_count     INT   DEFAULT 5,
  min_similarity  FLOAT DEFAULT 0.55
)
RETURNS TABLE (
  entry_id   TEXT,
  category   TEXT,
  content    TEXT,
  source     TEXT,
  similarity FLOAT
) LANGUAGE SQL STABLE AS $$
  SELECT
    entry_id,
    category,
    content,
    source,
    1 - (embedding <=> query_embedding) AS similarity
  FROM aria_kb_entries
  WHERE embedding IS NOT NULL
    AND (1 - (embedding <=> query_embedding)) > min_similarity
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER FUNCTION match_aria_kb_entries(vector, INT, FLOAT) SET search_path = public;

ALTER TABLE aria_kb_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access aria_kb_entries" ON aria_kb_entries;
CREATE POLICY "service role full access aria_kb_entries" ON aria_kb_entries
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

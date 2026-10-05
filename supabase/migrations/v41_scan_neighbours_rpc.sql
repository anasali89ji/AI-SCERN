-- v41: in-database pgvector neighbour summary for a single scan.
--
-- Why: the image verification page streams a "similar confirmed scans" panel. Doing the
-- lookup inside Postgres means the 384-dim embedding never travels to the Next.js server
-- (no HuggingFace call, no 3KB vector over the wire) -- the server only passes a scan id
-- and receives five integers/floats back.
--
-- Depends on: accuracy_monitoring.sql (detection_embeddings, vector(384), cosine ops).
-- Returns exactly one row. has_embedding = false means the scan has not been indexed yet
-- (rows are inserted after feedback is confirmed), which is different from "indexed but no
-- neighbours above min_similarity" (has_embedding = true, neighbour_count = 0).

CREATE OR REPLACE FUNCTION match_neighbours_for_scan(
  p_scan_id       UUID,
  match_count     INT   DEFAULT 10,
  min_similarity  FLOAT DEFAULT 0.72
)
RETURNS TABLE (
  has_embedding   BOOLEAN,
  neighbour_count INT,
  ai_count        INT,
  human_count     INT,
  avg_similarity  FLOAT
) LANGUAGE SQL STABLE AS $$
  WITH q AS (
    SELECT embedding, modality
    FROM detection_embeddings
    WHERE scan_id = p_scan_id
    LIMIT 1
  ),
  nn AS (
    SELECT n.ground_truth, 1 - (n.embedding <=> q.embedding) AS similarity
    FROM q
    CROSS JOIN LATERAL (
      SELECT de.ground_truth, de.embedding
      FROM detection_embeddings de
      WHERE de.modality = q.modality
        AND de.scan_id <> p_scan_id
      ORDER BY de.embedding <=> q.embedding
      LIMIT match_count
    ) n
  )
  SELECT
    EXISTS (SELECT 1 FROM q),
    (COUNT(*) FILTER (WHERE similarity > min_similarity))::INT,
    (COUNT(*) FILTER (WHERE similarity > min_similarity AND ground_truth = 'AI'))::INT,
    (COUNT(*) FILTER (WHERE similarity > min_similarity AND ground_truth = 'HUMAN'))::INT,
    COALESCE(AVG(similarity) FILTER (WHERE similarity > min_similarity), 0)::FLOAT
  FROM nn;
$$;

-- Service-role only: called from server code with the admin client after an ownership check.
REVOKE ALL ON FUNCTION match_neighbours_for_scan(UUID, INT, FLOAT) FROM PUBLIC;
REVOKE ALL ON FUNCTION match_neighbours_for_scan(UUID, INT, FLOAT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION match_neighbours_for_scan(UUID, INT, FLOAT) TO service_role;

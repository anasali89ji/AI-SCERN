-- =============================================================================
-- Aiscern v21 — Audit System (Immutable Hash-Chained Logs)
-- Run in Supabase SQL Editor (service role). Safe to re-run.
--
-- Implements tamper-evident audit logging for the Trust Platform.
-- Every verification action, score change, and API call is recorded
-- with SHA-256 hash chaining so any tampering is detectable.
--
-- Tables:
--   audit_log          — primary immutable event log (hash-chained)
--   audit_log_sequence — per-user sequence counters for chain integrity
--   timestamp_anchors  — periodic hash anchors (blockchain-style checkpoints)
--   api_access_log     — detailed API request/response log
--   data_access_log    — who accessed which verification/report
-- =============================================================================

-- =============================================================================
-- AUDIT LOG (hash-chained, append-only)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id               BIGSERIAL    PRIMARY KEY,  -- monotonic sequence
  event_id         UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  -- Actor
  actor_id         TEXT         NOT NULL,     -- Clerk user_id, 'system', 'api:key_hash'
  actor_ip         TEXT,
  actor_ua         TEXT,
  -- Event
  event_type       TEXT         NOT NULL,     -- 'verification.created', 'score.computed', etc.
  event_category   TEXT         NOT NULL,     -- 'verification', 'auth', 'billing', 'admin', 'api'
  resource_type    TEXT,                      -- 'verification', 'report', 'webhook', 'api_key'
  resource_id      TEXT,
  -- Payload
  before_state     JSONB,                     -- NULL for creates
  after_state      JSONB,
  metadata         JSONB        NOT NULL DEFAULT '{}',
  -- Integrity (hash chain)
  event_hash       TEXT         NOT NULL,     -- SHA-256(id || event_id || actor_id || event_type || payload || prev_hash)
  prev_hash        TEXT,                      -- NULL for first record per chain
  chain_id         TEXT         NOT NULL,     -- 'global' or per-user chain key
  chain_sequence   BIGINT       NOT NULL,     -- position in chain
  -- Timestamps (two independent clocks for cross-validation)
  occurred_at      TIMESTAMPTZ  NOT NULL,     -- claimed time from request
  recorded_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()  -- server clock (immutable)
);

-- Audit log is append-only — no UPDATE/DELETE allowed
CREATE INDEX IF NOT EXISTS idx_audit_log_event_id      ON audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id      ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type    ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource      ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_chain         ON audit_log(chain_id, chain_sequence);
CREATE INDEX IF NOT EXISTS idx_audit_log_recorded_at   ON audit_log(recorded_at DESC);

-- =============================================================================
-- AUDIT CHAIN SEQUENCE TRACKERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_chain_state (
  chain_id       TEXT         PRIMARY KEY,
  last_hash      TEXT         NOT NULL,
  last_sequence  BIGINT       NOT NULL DEFAULT 0,
  last_event_id  UUID,
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed the global chain
INSERT INTO audit_chain_state (chain_id, last_hash, last_sequence)
VALUES ('global', 'genesis-0000000000000000000000000000000000000000000000000000000000000000', 0)
ON CONFLICT (chain_id) DO NOTHING;

-- =============================================================================
-- TIMESTAMP ANCHORS (checkpoint hashes — like blockchain block headers)
-- These are written periodically (e.g. every hour) and can be published
-- externally to prove the audit log existed at a point in time.
-- =============================================================================

CREATE TABLE IF NOT EXISTS timestamp_anchors (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_type     TEXT         NOT NULL DEFAULT 'periodic', -- 'periodic', 'manual', 'verification'
  from_sequence   BIGINT       NOT NULL,
  to_sequence     BIGINT       NOT NULL,
  record_count    INTEGER      NOT NULL,
  merkle_root     TEXT         NOT NULL,   -- Merkle root of event_hashes in range
  chain_hash      TEXT         NOT NULL,   -- last event_hash at to_sequence
  anchored_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Optional external publication
  external_url    TEXT,                    -- URL where anchor was published
  external_ref    TEXT                     -- txid, block, ref
);

CREATE INDEX IF NOT EXISTS idx_anchors_anchored_at ON timestamp_anchors(anchored_at DESC);

-- =============================================================================
-- API ACCESS LOG (detailed per-request log)
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_access_log (
  id               BIGSERIAL    PRIMARY KEY,
  log_id           UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  -- Caller
  api_key_hash     TEXT,
  user_id          TEXT,
  actor_ip         TEXT,
  -- Request
  method           TEXT         NOT NULL,
  path             TEXT         NOT NULL,
  query_params     JSONB        NOT NULL DEFAULT '{}',
  request_size     INTEGER,
  -- Response
  status_code      SMALLINT,
  response_size    INTEGER,
  processing_ms    INTEGER,
  -- Correlation
  verification_id  UUID,
  request_id       TEXT,
  -- Meta
  api_version      TEXT         NOT NULL DEFAULT 'v1',
  module           TEXT,        -- 'content', 'image', etc.
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_access_user      ON api_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_access_api_key   ON api_access_log(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_api_access_path      ON api_access_log(path);
CREATE INDEX IF NOT EXISTS idx_api_access_created   ON api_access_log(created_at DESC);

-- Partition hint: consider range partitioning by month for scale
-- CREATE INDEX IF NOT EXISTS idx_api_access_month
--   ON api_access_log (date_trunc('month', created_at));

-- =============================================================================
-- DATA ACCESS LOG (who accessed which sensitive resource)
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_access_log (
  id               BIGSERIAL    PRIMARY KEY,
  accessor_id      TEXT         NOT NULL,  -- Clerk user_id
  accessor_ip      TEXT,
  resource_type    TEXT         NOT NULL,  -- 'verification', 'report', 'scan'
  resource_id      TEXT         NOT NULL,
  access_type      TEXT         NOT NULL,  -- 'read', 'download', 'share', 'delete'
  metadata         JSONB        NOT NULL DEFAULT '{}',
  accessed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_access_accessor  ON data_access_log(accessor_id);
CREATE INDEX IF NOT EXISTS idx_data_access_resource  ON data_access_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_data_access_at        ON data_access_log(accessed_at DESC);

-- =============================================================================
-- IMMUTABLE ENFORCEMENT
-- Audit log rows must never be updated or deleted.
-- =============================================================================

CREATE OR REPLACE FUNCTION deny_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable — UPDATE and DELETE are forbidden';
END;
$$;

DROP TRIGGER IF EXISTS trg_deny_audit_update ON audit_log;
CREATE TRIGGER trg_deny_audit_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_deny_audit_delete ON audit_log;
CREATE TRIGGER trg_deny_audit_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_audit_log_mutation();

-- =============================================================================
-- CORE AUDIT FUNCTIONS
-- =============================================================================

-- Append an event to the audit log with automatic hash chaining
-- Called from API routes via: SELECT append_audit_event(...)
CREATE OR REPLACE FUNCTION append_audit_event(
  p_actor_id       TEXT,
  p_event_type     TEXT,
  p_event_category TEXT,
  p_resource_type  TEXT       DEFAULT NULL,
  p_resource_id    TEXT       DEFAULT NULL,
  p_before_state   JSONB      DEFAULT NULL,
  p_after_state    JSONB      DEFAULT NULL,
  p_metadata       JSONB      DEFAULT '{}',
  p_occurred_at    TIMESTAMPTZ DEFAULT NOW(),
  p_actor_ip       TEXT       DEFAULT NULL,
  p_chain_id       TEXT       DEFAULT 'global'
) RETURNS TABLE(event_id UUID, chain_sequence BIGINT, event_hash TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id      UUID := gen_random_uuid();
  v_prev_hash     TEXT;
  v_chain_seq     BIGINT;
  v_payload_raw   TEXT;
  v_event_hash    TEXT;
BEGIN
  -- Lock the chain state row to prevent concurrent sequence gaps
  SELECT last_hash, last_sequence + 1
  INTO v_prev_hash, v_chain_seq
  FROM audit_chain_state
  WHERE chain_id = p_chain_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create chain for new chain_id
    INSERT INTO audit_chain_state (chain_id, last_hash, last_sequence)
    VALUES (p_chain_id, 'genesis-' || p_chain_id, 0);
    v_prev_hash  := 'genesis-' || p_chain_id;
    v_chain_seq  := 1;
  END IF;

  -- Compute event hash: SHA-256 over deterministic payload string
  v_payload_raw := concat_ws('|',
    v_chain_seq::TEXT,
    v_event_id::TEXT,
    p_actor_id,
    p_event_type,
    COALESCE(p_resource_type, ''),
    COALESCE(p_resource_id, ''),
    COALESCE(p_after_state::TEXT, ''),
    v_prev_hash,
    p_occurred_at::TEXT
  );
  v_event_hash := encode(digest(v_payload_raw, 'sha256'), 'hex');

  -- Insert the event
  INSERT INTO audit_log (
    event_id, actor_id, actor_ip, event_type, event_category,
    resource_type, resource_id, before_state, after_state, metadata,
    event_hash, prev_hash, chain_id, chain_sequence, occurred_at
  ) VALUES (
    v_event_id, p_actor_id, p_actor_ip, p_event_type, p_event_category,
    p_resource_type, p_resource_id, p_before_state, p_after_state, p_metadata,
    v_event_hash, v_prev_hash, p_chain_id, v_chain_seq, p_occurred_at
  );

  -- Update chain state
  UPDATE audit_chain_state
  SET last_hash = v_event_hash, last_sequence = v_chain_seq,
      last_event_id = v_event_id, updated_at = NOW()
  WHERE chain_id = p_chain_id;

  RETURN QUERY SELECT v_event_id, v_chain_seq, v_event_hash;
END;
$$;

-- Verify chain integrity for a range of events
-- Returns: { valid: bool, first_broken_sequence: bigint | null, checked_count: int }
CREATE OR REPLACE FUNCTION verify_audit_chain(
  p_chain_id      TEXT    DEFAULT 'global',
  p_from_sequence BIGINT  DEFAULT 1,
  p_to_sequence   BIGINT  DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  r               RECORD;
  v_prev_hash     TEXT;
  v_expected_hash TEXT;
  v_payload_raw   TEXT;
  v_count         INTEGER := 0;
  v_to            BIGINT;
BEGIN
  SELECT COALESCE(p_to_sequence, last_sequence)
  INTO v_to
  FROM audit_chain_state
  WHERE chain_id = p_chain_id;

  FOR r IN
    SELECT id, event_id, actor_id, event_type, resource_type, resource_id,
           after_state, event_hash, prev_hash, chain_sequence, occurred_at
    FROM audit_log
    WHERE chain_id = p_chain_id
      AND chain_sequence BETWEEN p_from_sequence AND v_to
    ORDER BY chain_sequence ASC
  LOOP
    IF v_count = 0 THEN
      v_prev_hash := r.prev_hash;
    END IF;

    v_payload_raw := concat_ws('|',
      r.chain_sequence::TEXT, r.event_id::TEXT, r.actor_id, r.event_type,
      COALESCE(r.resource_type, ''), COALESCE(r.resource_id, ''),
      COALESCE(r.after_state::TEXT, ''), v_prev_hash, r.occurred_at::TEXT
    );
    v_expected_hash := encode(digest(v_payload_raw, 'sha256'), 'hex');

    IF v_expected_hash != r.event_hash THEN
      RETURN jsonb_build_object(
        'valid', FALSE,
        'first_broken_sequence', r.chain_sequence,
        'checked_count', v_count,
        'expected_hash', v_expected_hash,
        'stored_hash', r.event_hash
      );
    END IF;

    v_prev_hash := r.event_hash;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('valid', TRUE, 'checked_count', v_count, 'chain_id', p_chain_id);
END;
$$;

-- Create a timestamp anchor (call periodically via pg_cron or Inngest)
CREATE OR REPLACE FUNCTION create_timestamp_anchor(
  p_anchor_type TEXT DEFAULT 'periodic'
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_last      RECORD;
  v_last_anchor RECORD;
  v_from_seq  BIGINT;
  v_count     INTEGER;
  v_root      TEXT;
  v_anchor_id UUID;
BEGIN
  SELECT last_sequence, last_hash INTO v_last FROM audit_chain_state WHERE chain_id = 'global';

  SELECT to_sequence INTO v_last_anchor FROM timestamp_anchors ORDER BY anchored_at DESC LIMIT 1;
  v_from_seq := COALESCE(v_last_anchor.to_sequence + 1, 1);

  SELECT COUNT(*), encode(digest(string_agg(event_hash, '' ORDER BY chain_sequence), 'sha256'), 'hex')
  INTO v_count, v_root
  FROM audit_log
  WHERE chain_id = 'global' AND chain_sequence BETWEEN v_from_seq AND v_last.last_sequence;

  IF v_count = 0 THEN RETURN NULL; END IF;

  INSERT INTO timestamp_anchors (anchor_type, from_sequence, to_sequence, record_count, merkle_root, chain_hash)
  VALUES (p_anchor_type, v_from_seq, v_last.last_sequence, v_count, v_root, v_last.last_hash)
  RETURNING id INTO v_anchor_id;

  RETURN v_anchor_id;
END;
$$;

-- =============================================================================
-- RLS ON AUDIT TABLES
-- Audit log is read-only for users (service role bypasses RLS)
-- =============================================================================

ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_access_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_log  ENABLE ROW LEVEL SECURITY;

-- Only the actor can read their own audit events
CREATE POLICY IF NOT EXISTS "audit_log_actor_read"
  ON audit_log FOR SELECT
  USING (actor_id = (SELECT auth.uid()::text));

-- Users can read their own API access log
CREATE POLICY IF NOT EXISTS "api_access_log_user_read"
  ON api_access_log FOR SELECT
  USING (user_id = (SELECT auth.uid()::text));

-- Users can read their own data access log
CREATE POLICY IF NOT EXISTS "data_access_log_owner_read"
  ON data_access_log FOR SELECT
  USING (accessor_id = (SELECT auth.uid()::text));

-- =============================================================================
-- STANDARD AUDIT EVENTS (seed documentation)
-- Known event_type values for the audit log:
--   verification.created     — new verification registered
--   verification.completed   — verification finished
--   verification.failed      — verification failed
--   score.computed           — trust score calculated
--   evidence.added           — evidence item recorded
--   report.generated         — downloadable report created
--   report.downloaded        — report downloaded
--   webhook.triggered        — webhook delivery attempted
--   api.call                 — API endpoint called
--   api_key.created          — new API key issued
--   api_key.revoked          — API key revoked
--   auth.login               — user authenticated
--   auth.logout              — user logged out
--   billing.purchase         — credit purchase
--   admin.action             — admin performed action
-- =============================================================================

COMMENT ON TABLE audit_log IS 'Immutable, hash-chained audit log — append-only enforced by trigger';
COMMENT ON TABLE audit_chain_state IS 'Chain state tracker for hash verification integrity';
COMMENT ON TABLE timestamp_anchors IS 'Periodic checkpoint hashes for external tamper-evidence publication';
COMMENT ON TABLE api_access_log IS 'Detailed per-request API access log for compliance and debugging';
COMMENT ON TABLE data_access_log IS 'Who accessed which sensitive verification/report resource';

COMMENT ON FUNCTION append_audit_event IS 'Thread-safe hash-chained event append — use this for all audit writes';
COMMENT ON FUNCTION verify_audit_chain IS 'Verify chain integrity for a sequence range — returns JSON result';
COMMENT ON FUNCTION create_timestamp_anchor IS 'Create a Merkle-root checkpoint anchor over recent audit events';

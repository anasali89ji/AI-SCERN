-- ============================================================
-- v14 — Admin Credits RPC + Plan Fields Fix
-- ============================================================

-- ── 1. Ensure all plan-related columns exist on profiles ─────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_balance   INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_remaining INTEGER     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_updated_at   TIMESTAMPTZ;

-- Keep both columns in sync via trigger
CREATE OR REPLACE FUNCTION sync_credits_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- If credits_balance was updated, mirror to credits_remaining
  IF NEW.credits_balance IS DISTINCT FROM OLD.credits_balance THEN
    NEW.credits_remaining := NEW.credits_balance;
  END IF;
  -- If credits_remaining was updated, mirror to credits_balance
  IF NEW.credits_remaining IS DISTINCT FROM OLD.credits_remaining THEN
    NEW.credits_balance := NEW.credits_remaining;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_credits ON profiles;
CREATE TRIGGER trg_sync_credits
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_credits_columns();

-- ── 2. admin_grant_credits RPC ───────────────────────────────
-- Called by the admin panel credits route.
-- Atomically updates balance and inserts a ledger entry.
CREATE OR REPLACE FUNCTION admin_grant_credits(
  p_user_id TEXT,
  p_delta   INTEGER,
  p_reason  TEXT DEFAULT 'admin_grant'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as DB owner, bypasses RLS
AS $$
DECLARE
  v_old_balance INTEGER;
  v_new_balance INTEGER;
  v_txn_id      UUID;
BEGIN
  -- Fetch & lock row
  SELECT credits_balance INTO v_old_balance
  FROM   profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- Calculate new balance (floor at 0)
  v_new_balance := GREATEST(0, COALESCE(v_old_balance, 0) + p_delta);

  -- Update profile
  UPDATE profiles
  SET    credits_balance   = v_new_balance,
         credits_remaining = v_new_balance
  WHERE  id = p_user_id;

  -- Insert ledger row
  INSERT INTO credit_transactions
    (user_id, transaction_type, credits, status, metadata)
  VALUES
    (p_user_id, 'admin_grant', p_delta, 'completed',
     jsonb_build_object('reason', p_reason, 'old_balance', v_old_balance, 'new_balance', v_new_balance))
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'old_balance', v_old_balance,
    'new_balance', v_new_balance,
    'txn_id',      v_txn_id
  );
END;
$$;

-- ── 3. admin_set_plan RPC ────────────────────────────────────
-- Atomically changes plan + resets credits + inserts ledger.
CREATE OR REPLACE FUNCTION admin_set_plan(
  p_user_id  TEXT,
  p_new_plan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_plan TEXT;
  v_credits  INTEGER;
BEGIN
  -- Validate plan
  IF p_new_plan NOT IN ('free','starter','pro','enterprise') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_plan');
  END IF;

  -- Get credit allocation from plan_limits
  SELECT credits_included INTO v_credits
  FROM   plan_limits
  WHERE  plan = p_new_plan;

  v_credits := COALESCE(v_credits, 0);

  -- Fetch current plan
  SELECT plan INTO v_old_plan FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- Update profile
  UPDATE profiles SET
    plan                = p_new_plan,
    plan_id             = p_new_plan,
    subscription_status = CASE WHEN p_new_plan = 'free' THEN 'free' ELSE 'active' END,
    credits_balance     = v_credits,
    credits_remaining   = v_credits,
    plan_updated_at     = NOW()
  WHERE id = p_user_id;

  -- Ledger entry
  IF v_credits > 0 THEN
    INSERT INTO credit_transactions
      (user_id, transaction_type, credits, plan_id, status, metadata)
    VALUES
      (p_user_id, 'admin_grant', v_credits, p_new_plan, 'completed',
       jsonb_build_object('reason','admin_plan_change','old_plan',v_old_plan,'new_plan',p_new_plan));
  END IF;

  RETURN jsonb_build_object(
    'ok',      true,
    'old_plan', v_old_plan,
    'new_plan', p_new_plan,
    'credits',  v_credits
  );
END;
$$;

-- ── 4. Grant execute to service role ─────────────────────────
GRANT EXECUTE ON FUNCTION admin_grant_credits(TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_set_plan(TEXT, TEXT)               TO service_role;

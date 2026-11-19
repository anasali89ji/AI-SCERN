import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signal-worker workflow callback.
 *
 * WH-SIG-1 (audit 2026-11): the HMAC was (a) computed over the RE-SERIALIZED
 * parsed body (any whitespace/key-order difference between sender and V8
 * JSON.stringify broke valid signatures), and (b) compared with plain `!==`
 * (timing oracle). Now: HMAC over the raw request text, constant-time compare,
 * and a missing/unset secret is a 500 with a clear operator message instead
 * of a thrown TypeError.
 *
 * WH-IDEM-1 (audit 2026-11): the update was unconditional — a replayed
 * 'running' payload could overwrite a LATER 'completed' state, duplicate
 * deliveries re-issued writes, and DB errors returned 200 {received:true}
 * (worker retried nothing, caller believed success). Now: status-transition
 * guard (terminal states are never overwritten except by identical replay),
 * error propagation, and idempotent replay of the same terminal payload.
 */
export async function POST(req: NextRequest) {
  // RAW body text — the sender signs these exact bytes.
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  const secret = process.env.SIGNAL_WORKER_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhooks/signal-worker] SIGNAL_WORKER_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const expectedSig = createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signature ?? '', 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  const valid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: {
    runId?: string;
    status?: string;
    stepResults?: unknown;
    output?: unknown;
    completedAt?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.runId || typeof payload.runId !== 'string') {
    return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Read current state — transition guard + idempotent replay need it.
  const { data: current, error: readErr } = await supabase
    .from('workflow_runs')
    .select('id, status, output, completed_at')
    .eq('id', payload.runId)
    .maybeSingle();

  if (readErr) {
    console.error('[webhooks/signal-worker] read error:', readErr.message);
    return NextResponse.json({ error: 'Failed to read run state' }, { status: 502 });
  }
  if (!current) {
    // Unknown run: reject (a validly-signed but stale/expired callback).
    return NextResponse.json({ error: 'Unknown runId' }, { status: 404 });
  }

  const TERMINAL = new Set(['complete', 'completed', 'failed', 'cancelled']);
  const next = payload.status ?? 'completed';

  if (TERMINAL.has(String(current.status))) {
    // Idempotent replay of the same terminal state: acknowledge, no write.
    if (current.status === next || (current.status === 'completed' && next === 'complete')) {
      return NextResponse.json({ received: true, replay: true });
    }
    // Attempting to move a terminal run back to a non-terminal state — reject.
    console.warn(
      `[webhooks/signal-worker] rejected transition ${current.status} -> ${next} for run ${payload.runId}`
    );
    return NextResponse.json({ error: 'Run already terminal' }, { status: 409 });
  }

  const { error: updateErr } = await supabase
    .from('workflow_runs')
    .update({
      step_results: payload.stepResults,
      output: payload.output,
      status: next,
      completed_at: payload.completedAt ?? new Date().toISOString(),
    })
    .eq('id', payload.runId);

  if (updateErr) {
    console.error('[webhooks/signal-worker] update error:', updateErr.message);
    return NextResponse.json({ error: 'Failed to persist run result' }, { status: 502 });
  }

  return NextResponse.json({ received: true });
}

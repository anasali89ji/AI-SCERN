import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const signature = req.headers.get('x-signature');

  const expectedSig = createHmac('sha256', process.env.SIGNAL_WORKER_WEBHOOK_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== expectedSig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  await supabase
    .from('workflow_runs')
    .update({
      step_results: payload.stepResults,
      output: payload.output,
      status: payload.status,
      completed_at: payload.completedAt,
    })
    .eq('id', payload.runId);

  return NextResponse.json({ received: true });
}

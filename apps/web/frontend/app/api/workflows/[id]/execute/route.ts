import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import { validateEnv } from '@/lib/env-validator';


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    validateEnv();
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !workflow) {
    return NextResponse.json({ success: false, error: 'Workflow not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const { data: run, error: runError } = await supabase
    .from('workflow_runs')
    .insert({
      workflow_id: workflow.id,
      user_id: userId,
      status: 'pending',
      step_results: workflow.steps.map((step: any) => ({
        stepId: step.id,
        status: 'pending',
        logs: [],
      })),
    })
    .select()
    .single();

  if (runError) {
    return NextResponse.json({ success: false, error: 'Failed to create run', code: 'DB_ERROR' }, { status: 500 });
  }

  await inngest.send({
    name: 'workflow/execute',
    data: {
      runId: run.id,
      workflowId: workflow.id,
      userId,
      steps: workflow.steps,
    },
  });

  return NextResponse.json({ success: true, data: { runId: run.id, status: 'pending' } });
}

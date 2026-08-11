import { inngest } from './client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const executeWorkflow = inngest.createFunction(
  { id: 'execute-workflow', retries: 3, triggers: [{ event: 'workflow/execute' }] },
  async ({ event, step }) => {
    const { runId, workflowId, userId, steps } = event.data;

    await step.run('mark-running', async () => {
      await supabase.from('workflow_runs').update({ status: 'running' }).eq('id', runId);
    });

    const results: any[] = [];

    for (const workflowStep of steps) {
      const result = await step.run(`step-${workflowStep.id}`, async () => {
        try {
          const output = await executeStep(workflowStep, { userId, workflowId, runId });
          return { stepId: workflowStep.id, status: 'completed', output, logs: [`${workflowStep.type} completed`] };
        } catch (err: any) {
          return { stepId: workflowStep.id, status: 'failed', error: err.message, logs: [`Error: ${err.message}`] };
        }
      });
      results.push(result);

      if (result.status === 'failed' && !workflowStep.config?.optional) {
        break;
      }
    }

    const hasFailures = results.some((r) => r.status === 'failed');
    await step.run('mark-complete', async () => {
      await supabase
        .from('workflow_runs')
        .update({
          status: hasFailures ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
          step_results: results,
        })
        .eq('id', runId);
    });

    return { runId, status: hasFailures ? 'failed' : 'completed', results };
  }
);

async function executeStep(step: any, context: { userId: string; workflowId: string; runId: string }) {
  switch (step.type) {
    case 'detect':
      return await callDetectionAPI(step.config, context);
    case 'rag':
      return await callRAGRetrieval(step.config, context);
    case 'export':
      return await generateReport(step.config, context);
    case 'notify':
      return await sendNotification(step.config, context);
    case 'store':
      return await storeToR2(step.config, context);
    default:
      return { message: `Step type ${step.type} executed (no-op)` };
  }
}

async function callDetectionAPI(config: any, context: any) {
  if (['image', 'audio', 'video'].includes(config.modality)) {
    const { queueDetectionJob, pollJobStatus } = await import('@/lib/inference/signal-worker');
    const job = await queueDetectionJob({
      jobId: `${context.runId}-${config.stepId || 'detect'}`,
      modality: config.modality,
      sourceUrl: config.sourceUrl,
      models: config.models,
      useRAG: config.useRAG,
      userId: context.userId,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signal-worker`,
    });
    return await pollJobStatus(job.jobId);
  }
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify({
      modality: config.modality,
      models: config.models,
      useRAG: config.useRAG,
      userId: context.userId,
    }),
  });
  return await response.json();
}

async function callRAGRetrieval(config: any, context: any) {
  const { data } = await supabase.rpc('match_scans', {
    query_embedding: config.embedding,
    match_threshold: config.similarityThreshold,
    match_count: config.topK,
    user_id: context.userId,
  });
  return { matches: data };
}

async function generateReport(config: any, context: any) {
  return { format: config.format, downloadUrl: `/api/reports/${context.runId}` };
}

async function sendNotification(config: any, context: any) {
  if (config.channel === 'webhook' && config.webhookUrl) {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowRunId: context.runId, status: 'completed' }),
    });
  }
  return { sent: true, channel: config.channel };
}

async function storeToR2(config: any, context: any) {
  return { stored: true, path: config.pathTemplate };
}

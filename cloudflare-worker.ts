// ════════════════════════════════════════════════════════════════════════════
// AISCERN Cloudflare Worker — Long-running scan endpoint
// ════════════════════════════════════════════════════════════════════════════

interface WorkersAIBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<any>;
}

export interface Env {
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  AI: WorkersAIBinding; // Workers AI binding — no API key, no cold start, always available
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/scan' && request.method === 'POST') {
        return await handleScan(request, env);
      }
      if (path === '/chat' && request.method === 'POST') {
        return await handleChat(request, env, ctx);
      }
      if (path === '/health' && request.method === 'GET') {
        return json({ status: 'ok', worker: 'detectai', timestamp: Date.now() });
      }
      return json({ error: 'Not found' }, 404);
    } catch (err: any) {
      return json({ error: err.message || 'Internal error' }, 500);
    }
  },
};

async function handleScan(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { url: targetUrl, maxPages = 15, maxDepth = 2 } = body as any;

  if (!targetUrl) {
    return json({ error: 'URL required' }, 400);
  }

  const jobId = crypto.randomUUID();

  return json({
    success: true,
    jobId,
    worker: 'detectai',
    message: 'Scan job accepted. Full implementation connects to crawler engine.',
    targetUrl,
    maxPages,
    maxDepth,
    queuedAt: new Date().toISOString(),
  });
}

async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { messages } = body as any;

  type Provider = { name: string; apiKey: string; upstream: string; model: string; extraHeaders?: Record<string, string> };

  const providers: Provider[] = [];
  if (env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      apiKey: env.GROQ_API_KEY,
      upstream: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'openai/gpt-oss-120b',
    });
  }
  if (env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      apiKey: env.OPENROUTER_API_KEY,
      upstream: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      extraHeaders: { 'HTTP-Referer': 'https://aiscern.com', 'X-Title': 'Aiscern' },
    });
  }
  if (env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini',
      apiKey: env.GEMINI_API_KEY,
      upstream: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: 'gemini-2.0-flash',
    });
  }
  if (env.NVIDIA_API_KEY) {
    providers.push({
      name: 'nvidia',
      apiKey: env.NVIDIA_API_KEY,
      upstream: 'https://integrate.api.nvidia.com/v1/chat/completions',
      model: 'meta/llama-3.3-70b-instruct',
    });
  }

  let upstreamRes: Response | null = null;
  const errors: string[] = [];

  for (const provider of providers) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {}),
    };

    try {
      const res = await fetch(provider.upstream, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model,
          messages: messages?.map((m: any) => ({ role: m.role, content: m.content })) || [],
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        upstreamRes = res;
        break;
      }
      errors.push(`[${provider.name}] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } catch (err: any) {
      errors.push(`[${provider.name}] ${err.name === 'TimeoutError' ? 'timed out after 15s' : (err.message || String(err))}`);
    }
  }

  if (!upstreamRes) {
    console.error('[handleChat] All external providers failed:', errors.join(' | '));

    // ── Final fallback: Workers AI (Cloudflare's own edge inference) ────────
    // No API key to misconfigure, no cold start, no external rate limit —
    // this only fails if the account itself has no Workers AI access.
    try {
      const aiResult: any = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-awq', {
        messages: messages?.map((m: any) => ({ role: m.role, content: m.content })) || [],
        max_tokens: 1024,
      });

      const text: string = aiResult?.response || '';
      if (!text) throw new Error('Workers AI returned an empty response');

      // Not natively streamed here (avoids depending on Workers AI's raw SSE
      // chunk shape, which differs from the OpenAI delta shape the other
      // four providers use) — instead we chunk the completed text ourselves
      // so the frontend's existing SSE parser works unchanged either way.
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      ctx.waitUntil((async () => {
        const words = text.split(' ');
        try {
          for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
          }
          await writer.write(encoder.encode('data: {"type":"done"}\n\n'));
        } finally {
          await writer.close();
        }
      })());

      return new Response(readable, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Chat-Provider': 'workers-ai-fallback',
        },
      });
    } catch (err: any) {
      errors.push(`[workers-ai] ${err.message || String(err)}`);
      console.error('[handleChat] Workers AI fallback also failed:', err);
      return json({ error: 'All providers failed.', details: errors }, 502);
    }
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  ctx.waitUntil((async () => {
    const reader = upstreamRes.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            await writer.write(encoder.encode('data: {"type":"done"}\n\n'));
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`));
            }
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      await writer.close();
    }
  })());

  return new Response(readable, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

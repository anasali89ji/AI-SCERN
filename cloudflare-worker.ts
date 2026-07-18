// ════════════════════════════════════════════════════════════════════════════
// AISCERN Cloudflare Worker — Long-running scan endpoint
// ════════════════════════════════════════════════════════════════════════════

export interface Env {
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  NVIDIA_API_KEY?: string;
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
      model: 'llama-3.3-70b-versatile',
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

  if (!providers.length) {
    return json({
      text: "I'm ARIA, Aiscern's detection assistant. I can analyze text, images, audio, and video for AI-generated content. Upload a file or ask me anything about deepfake detection.",
      source: 'knowledge_base_fallback',
    });
  }

  let upstreamRes: Response | null = null;
  let lastErr = '';

  for (const provider of providers) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {}),
    };

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
    });

    if (res.ok) {
      upstreamRes = res;
      break;
    }
    lastErr = `[${provider.name}] ${await res.text()}`;
  }

  if (!upstreamRes) {
    return json({ error: `All providers failed. Last error: ${lastErr}` }, 502);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  ctx.waitFor((async () => {
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

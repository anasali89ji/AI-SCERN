// ════════════════════════════════════════════════════════════════════════════
// AISCERN Cloudflare Worker — Long-running scan endpoint
// ════════════════════════════════════════════════════════════════════════════

export interface Env {
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
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

  const apiKey = env.OPENROUTER_API_KEY || env.GROQ_API_KEY;
  
  if (!apiKey) {
    return json({
      text: "I'm ARIA, Aiscern's detection assistant. I can analyze text, images, audio, and video for AI-generated content. Upload a file or ask me anything about deepfake detection.",
      source: 'knowledge_base_fallback',
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const model = env.GROQ_API_KEY 
    ? 'llama-3.3-70b-versatile' 
    : 'meta-llama/llama-3.3-70b-instruct:free';

  if (!env.GROQ_API_KEY) {
    headers['HTTP-Referer'] = 'https://aiscern.com';
    headers['X-Title'] = 'Aiscern';
  }

  const upstream = env.GROQ_API_KEY
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const upstreamRes = await fetch(upstream, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: messages?.map((m: any) => ({ role: m.role, content: m.content })) || [],
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!upstreamRes.ok) {
    const err = await upstreamRes.text();
    return json({ error: `Upstream error: ${err}` }, 502);
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

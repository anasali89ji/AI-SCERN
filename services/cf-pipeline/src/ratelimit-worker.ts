/**
 * Aiscern — Cloudflare Edge Rate Limiter (Module 6.1)
 *
 * Intercepts /api/detect/* requests at the edge.
 * KV-backed sliding window: 20 req / 60s per IP per endpoint.
 * Requests that pass the check are proxied through to Vercel.
 */

export interface Env {
  RATE_LIMITS: KVNamespace
  UPSTREAM:    string   // set via: wrangler secret put UPSTREAM (value: https://aiscern.com)
}

const LIMITS: Record<string, number> = {
  image: 20,
  text:  30,
  audio: 15,
  video: 10,
  pdf:   20,
}
const WINDOW_SECONDS = 60

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url  = new URL(request.url)
    const path = url.pathname

    // Only rate-limit detect API endpoints
    if (request.method !== 'OPTIONS' && path.startsWith('/api/detect/')) {
      const endpoint = path.split('/')[3] ?? 'unknown'
      const limit    = LIMITS[endpoint] ?? 20
      const ip       = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      const key      = `rl:${ip}:${endpoint}`

      const current = parseInt(await env.RATE_LIMITS.get(key) ?? '0', 10)

      if (current >= limit) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code:    'RATE_LIMIT_EXCEEDED',
              message: `Too many requests. Maximum ${limit} requests per minute for ${endpoint} detection.`,
            },
          }),
          {
            status:  429,
            headers: {
              'Content-Type':   'application/json',
              'Retry-After':    String(WINDOW_SECONDS),
              'X-RateLimit-Limit':     String(limit),
              'X-RateLimit-Remaining': '0',
              'Access-Control-Allow-Origin': '*',
            },
          },
        )
      }

      // Increment counter (fire-and-forget — don't await to keep latency low)
      env.RATE_LIMITS.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS }).catch(() => {})
    }

    // CORS preflight passthrough
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // Proxy all other requests to Vercel upstream
    const upstream = env.UPSTREAM ?? 'https://aiscern.com'
    const proxyUrl = upstream + path + url.search
    return fetch(new Request(proxyUrl, {
      method:  request.method,
      headers: request.headers,
      body:    request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    }))
  },
}

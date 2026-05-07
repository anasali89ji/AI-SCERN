/**
 * Aiscern — Cloudflare Worker Load Balancer v2.1
 *
 * Routes:
 *  - /api/*  → Vercel only (Netlify times out at 10s)
 *  - pages   → Round-robin across Vercel + Netlify + CF Pages
 *
 * Deploy: wrangler deploy --config wrangler-lb.toml
 */

interface Env {
  HEALTH_KV:      KVNamespace
  VERCEL_URL:     string
  NETLIFY_URL:    string
  CF_PAGES_URL:   string
  LB_SECRET:      string
}

interface OriginConfig {
  name:      string
  url:       string
  weight:    number
  healthy:   boolean
  failCount: number
  lastCheck: number
}

const HEALTH_TTL_MS  = 30_000   // re-check health every 30s
const MAX_FAIL_COUNT = 3        // mark unhealthy after 3 consecutive failures
const KV_KEY         = 'origins:v1'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOrigins(env: Env): Promise<OriginConfig[]> {
  try {
    const cached = await env.HEALTH_KV.get(KV_KEY, 'json') as OriginConfig[] | null
    if (cached) return cached
  } catch {}

  return [
    { name: 'vercel',    url: env.VERCEL_URL,   weight: 3, healthy: true, failCount: 0, lastCheck: 0 },
    { name: 'netlify',   url: env.NETLIFY_URL,  weight: 2, healthy: true, failCount: 0, lastCheck: 0 },
    { name: 'cf-pages',  url: env.CF_PAGES_URL, weight: 2, healthy: true, failCount: 0, lastCheck: 0 },
  ]
}

async function saveOrigins(env: Env, origins: OriginConfig[]): Promise<void> {
  try { await env.HEALTH_KV.put(KV_KEY, JSON.stringify(origins), { expirationTtl: 300 }) } catch {}
}

async function checkHealth(origin: OriginConfig): Promise<boolean> {
  try {
    const res = await fetch(`${origin.url}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

function selectOrigin(origins: OriginConfig[], request: Request): OriginConfig {
  if (origins.length === 0) throw new Error('No origins available')

  const healthy = origins.filter(o => o.healthy)
  const pool    = healthy.length > 0 ? healthy : origins

  const country        = (request as any).cf?.country as string | undefined
  const cfPagesOrigin  = pool.find(o => o.name === 'cf-pages')
  const isNonUS        = country && country !== 'US' && country !== 'PK'
  if (isNonUS && cfPagesOrigin) return cfPagesOrigin

  const weighted: OriginConfig[] = []
  for (const origin of pool) {
    for (let i = 0; i < origin.weight; i++) weighted.push(origin)
  }

  const ip   = (request as any).cf?.connectingIp || request.headers.get('CF-Connecting-IP') || 'unknown'
  const hash = [...ip].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return weighted[hash % weighted.length]
}

async function proxyRequest(request: Request, origin: OriginConfig): Promise<Response> {
  const url    = new URL(request.url)
  const target = `${origin.url}${url.pathname}${url.search}`

  const headers = new Headers(request.headers)
  headers.set('X-Forwarded-Host', url.hostname)
  headers.set('X-Origin-Name', origin.name)

  return fetch(target, {
    method:  request.method,
    headers,
    body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  })
}

async function getCachedResponse(url: URL, env: Env): Promise<Response | null> {
  const cacheKey = `cache:${url.pathname}${url.search}`
  try {
    const cached = await env.HEALTH_KV.get(cacheKey)
    if (cached) return new Response(cached, { headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' } })
  } catch {}
  return null
}

async function cacheResponse(url: URL, response: Response, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cacheableRoutes = ['/api/health', '/api/warmup']
  if (!cacheableRoutes.some(r => url.pathname === r)) return response

  const body = await response.text()
  ctx.waitUntil(env.HEALTH_KV.put(`cache:${url.pathname}${url.search}`, body, { expirationTtl: 30 }))

  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('X-Cache', 'MISS')
  return new Response(body, { status: response.status, headers: responseHeaders })
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/lb-status') {
      const secret = request.headers.get('X-LB-Secret')
      if (secret !== env.LB_SECRET) return new Response('Unauthorized', { status: 401 })
      const origins = await getOrigins(env)
      return Response.json({ origins, timestamp: new Date().toISOString() })
    }

    if (url.pathname === '/lb-health') {
      return Response.json({ status: 'ok', version: '2.1', timestamp: Date.now() })
    }

    const isApiRoute = url.pathname.startsWith('/api/')
    const origins    = await getOrigins(env)

    ctx.waitUntil((async () => {
      let updated = false
      for (const origin of origins) {
        const now = Date.now()
        if (now - origin.lastCheck >= HEALTH_TTL_MS) {
          const isHealthy  = await checkHealth(origin)
          origin.lastCheck = now
          if (isHealthy) { origin.failCount = 0; origin.healthy = true }
          else { origin.failCount++; origin.healthy = origin.failCount < MAX_FAIL_COUNT }
          updated = true
        }
      }
      if (updated) await saveOrigins(env, origins)
    })())

    // API routes: Vercel only (Netlify timeouts at 10s, CF Pages edge runtime lacks Node.js APIs)
    // Static/page routes: all 3 origins (round-robin with geo preference)
    const eligibleOrigins = isApiRoute
      ? origins.filter(o => o.name === 'vercel' && o.healthy)
      : origins

    // If Vercel is down and it's an API call, try CF Pages as fallback
    const pool = eligibleOrigins.length > 0
      ? eligibleOrigins
      : origins.filter(o => o.name !== 'netlify' && o.healthy)

    const origin = selectOrigin(pool.length > 0 ? pool : origins, request)

    // Edge cache check for health-check routes
    if (isApiRoute) {
      const cached = await getCachedResponse(url, env)
      if (cached) return cached
    }

    try {
      const response = await proxyRequest(request, origin)
      if (isApiRoute && response.ok) {
        return await cacheResponse(url, response, env, ctx)
      }
      return response
    } catch {
      origin.failCount++
      origin.healthy = false
      ctx.waitUntil(saveOrigins(env, origins))

      // API fallback: return 503 immediately (no point trying Netlify)
      if (isApiRoute) {
        return new Response(JSON.stringify({
          error: 'Detection service temporarily unavailable',
          message: 'Please retry in 30 seconds.',
          retry_after: 30,
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
        })
      }

      // Page fallback: try next healthy origin
      const fallback = origins.find(o => o.healthy && o.name !== origin.name)
      if (fallback) {
        try { return await proxyRequest(request, fallback) } catch {}
      }

      return new Response('Service unavailable', { status: 503 })
    }
  },
}

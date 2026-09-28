/**
 * Aiscern Proxy Worker
 * Deploy: wrangler deploy proxy-worker.ts --name aiscern-proxy
 */

interface Env { PROXY_SECRET: string }

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const secret = request.headers.get('X-Proxy-Secret')
    if (!secret || secret !== env.PROXY_SECRET) return new Response('Unauthorized', { status: 401 })

    const url    = new URL(request.url)
    const target = url.searchParams.get('url')
    if (!target) return new Response('url parameter required', { status: 400 })

    let targetUrl: URL
    try { targetUrl = new URL(target) } catch { return new Response('Invalid target URL', { status: 400 }) }

    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].some(b => targetUrl.hostname.includes(b))) {
      return new Response('Private addresses blocked', { status: 403 })
    }

    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Cache-Control': 'no-cache' },
        redirect: 'follow',
      })
      const body        = await res.text()
      const contentType = res.headers.get('Content-Type') || 'text/html; charset=utf-8'
      return new Response(body, { status: res.status, headers: { 'Content-Type': contentType, 'X-Proxy-Status': 'ok' } })
    } catch (e) {
      return new Response(`Proxy fetch failed: ${(e as Error).message}`, { status: 502 })
    }
  },
}

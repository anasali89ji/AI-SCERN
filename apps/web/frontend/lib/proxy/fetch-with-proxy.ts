/**
 * Aiscern — Proxy-Aware Fetch
 * Routes through Cloudflare Worker proxy first, then static pool, then direct.
 */
import { getNextProxy, markProxyFailed, type ProxyConfig } from './rotation'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

export interface ProxyFetchOptions {
  maxRetries?: number
  timeoutMs?:  number
  headers?:    Record<string, string>
}

export async function fetchWithProxy(
  targetUrl: string,
  opts: ProxyFetchOptions = {},
): Promise<Response> {
  const { maxRetries = 3, timeoutMs = 12000, headers: extraHeaders = {} } = opts

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const proxy = await getNextProxy()

    try {
      let res: Response

      if (proxy.type === 'cloudflare' && proxy.cfUrl && proxy.secret) {
        const workerUrl = new URL(proxy.cfUrl)
        workerUrl.searchParams.set('url', targetUrl)
        res = await fetch(workerUrl.toString(), {
          headers: {
            'X-Proxy-Secret': proxy.secret,
            'User-Agent':     randomUA(),
            ...extraHeaders,
          },
          signal: AbortSignal.timeout(timeoutMs),
        })
      } else {
        res = await fetch(targetUrl, {
          headers: {
            'User-Agent':      randomUA(),
            'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control':   'no-cache',
            'Pragma':          'no-cache',
            ...extraHeaders,
          },
          signal:   AbortSignal.timeout(timeoutMs),
          redirect: 'follow',
        })
      }

      if ((res.status === 403 || res.status === 429 || res.status === 503) && attempt < maxRetries - 1) {
        markProxyFailed(proxy)
        await new Promise(r => setTimeout(r, (attempt + 1) * 1500))
        continue
      }

      return res
    } catch (err) {
      markProxyFailed(proxy)
      if (attempt === maxRetries - 1) throw err
      await new Promise(r => setTimeout(r, (attempt + 1) * 1000))
    }
  }

  throw new Error(`fetchWithProxy: all ${maxRetries} attempts failed for ${targetUrl}`)
}

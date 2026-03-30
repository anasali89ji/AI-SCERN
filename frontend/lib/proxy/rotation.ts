/**
 * Aiscern — Multi-Proxy Rotation System
 *
 * 3-tier priority:
 *   1. Cloudflare Worker proxy gateway (zero egress cost)
 *   2. Static proxy pool from PROXY_POOL env var
 *   3. Direct fetch (no proxy) as final fallback
 */

export interface ProxyConfig {
  type:      'cloudflare' | 'http' | 'direct'
  url?:      string
  cfUrl?:    string
  secret?:   string
  host?:     string
  port?:     number
  username?: string
  password?: string
}

class ProxyRotator {
  private proxies:    ProxyConfig[] = []
  private index       = 0
  private failed      = new Set<string>()
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    if (process.env.CF_PROXY_URL && process.env.CF_PROXY_SECRET) {
      this.proxies.push({
        type:   'cloudflare',
        cfUrl:  process.env.CF_PROXY_URL,
        secret: process.env.CF_PROXY_SECRET,
      })
    }

    const pool = process.env.PROXY_POOL || ''
    if (pool) {
      for (const raw of pool.split(',')) {
        const url = raw.trim()
        if (!url) continue
        try {
          const parsed = new URL(url)
          this.proxies.push({
            type:     'http',
            url,
            host:     parsed.hostname,
            port:     parseInt(parsed.port) || 8080,
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
          })
        } catch { /* skip malformed */ }
      }
    }

    this.proxies.push({ type: 'direct' })
  }

  next(): ProxyConfig {
    const available = this.proxies.filter(p => {
      const key = p.cfUrl ?? p.url ?? 'direct'
      return !this.failed.has(key)
    })
    if (!available.length) {
      this.failed.clear()
      return this.proxies[this.proxies.length - 1] ?? { type: 'direct' }
    }
    const proxy = available[this.index % available.length]
    this.index++
    return proxy
  }

  markFailed(proxy: ProxyConfig): void {
    const key = proxy.cfUrl ?? proxy.url ?? 'direct'
    this.failed.add(key)
  }
}

const _rotator = new ProxyRotator()

export async function getNextProxy(): Promise<ProxyConfig> {
  await _rotator.init()
  return _rotator.next()
}

export function markProxyFailed(proxy: ProxyConfig): void {
  _rotator.markFailed(proxy)
}

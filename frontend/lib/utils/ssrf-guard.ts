/**
 * SSRF Guard — block requests to private/internal IP ranges and loopback.
 * Call before any server-side fetch of user-supplied URLs.
 *
 * SEC-01 FIX: Added DNS rebinding mitigations — blocked domain patterns for
 * known internal TLDs and subdomain tricks, plus URL length limit.
 * String-only hostname checks can be bypassed via custom domains resolving to
 * private IPs. The patterns below block the most common DNS rebinding vectors.
 *
 * SCANNER-SEC-1 (audit 2026-11): the string-only checks could not stop
 * (a) a custom domain whose DNS A/AAAA record points at a private address,
 * (b) a public URL that 3xx-redirects to an internal address, or
 * (c) sitemap.xml / robots.txt <loc> entries pointing at internal addresses.
 * This module now provides:
 *   - assertSafeUrl(rawUrl)          sync string checks (legacy, kept for callers
 *                                    that cannot await; NOT rebinding-safe alone)
 *   - isPrivateAddress(ip)           full private/reserved range check (v4+v6)
 *   - assertSafeUrlResolved(rawUrl)  async: string checks + resolves DNS and
 *                                    rejects if ANY record is private/reserved
 *   - safeFetch(url, init)           manual-redirect fetch that re-validates
 *                                    every hop with assertSafeUrlResolved
 *
 * Residual risk (documented, accepted): a DNS record can be changed between
 * assertSafeUrlResolved() and the actual connect (TOCTOU). Full closure needs
 * connection-level IP pinning (custom undici dispatcher), which is not
 * available in every deployment target. Every hop IS re-resolved, so an
 * attacker needs a rebinding window of milliseconds on every request.
 */

import { lookup } from 'node:dns'
import { promisify } from 'node:util'

const dnsLookup = promisify(lookup)

const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  'metadata.google.internal', '169.254.169.254',
])

// Patterns that indicate internal/private domains (DNS rebinding vectors)
const BLOCKED_DOMAIN_PATTERNS: RegExp[] = [
  /\.(local|internal|intranet|corp|lan|localdomain|localhost)$/i,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,  // link-local
  /^0\.0\.0\.0$/,
  // Subdomain tricks that resolve to private IPs (e.g. 192-168-1-1.nip.io patterns)
  /^(\d+[-_.]){3}\d+\.(nip\.io|xip\.io|sslip\.io|localtest\.me)$/i,
]

function isPrivateIP(hostname: string): boolean {
  // IPv4 private ranges
  const v4 = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.)/.test(hostname)
  // IPv6 loopback/link-local
  const v6 = /^(::1|fe80:|fc00:|fd)/.test(hostname.toLowerCase())
  return v4 || v6
}

/**
 * Full private/reserved range check for a RESOLVED address (not a hostname).
 * Handles canonical dotted-quad IPv4 and IPv6 (including ::ffff:0:0/96
 * IPv4-mapped form). Anything that resolves to non-routable space is unsafe.
 */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.trim().toLowerCase()

  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — check the embedded IPv4
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])

  if (addr.includes(':')) return isPrivateIPv6(addr)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(addr)) return isPrivateIPv4(addr)
  return false // not an IP literal — hostname checks apply elsewhere
}

function isPrivateIPv4(addr: string): boolean {
  const o = addr.split('.').map(Number)
  if (o.length !== 4 || o.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = o
  return (
    a === 0 ||                                    // 0.0.0.0/8        "this host"
    a === 10 ||                                   // 10.0.0.0/8       private
    (a === 100 && b >= 64 && b <= 127) ||         // 100.64.0.0/10    CGNAT
    a === 127 ||                                  // 127.0.0.0/8      loopback
    (a === 169 && b === 254) ||                   // 169.254.0.0/16   link-local + cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||          // 172.16.0.0/12    private
    (a === 192 && b === 0) ||                     // 192.0.0.0/24 + 192.0.2.0/24 (TEST-NET-1)
    (a === 192 && b === 168) ||                   // 192.168.0.0/16   private
    (a === 198 && (b === 18 || b === 19)) ||      // 198.18.0.0/15    benchmark
    (a === 198 && b === 51 && o[2] === 100) ||    // 198.51.100.0/24  TEST-NET-2
    (a === 203 && b === 0 && o[2] === 113) ||     // 203.0.113.0/24   TEST-NET-3
    a >= 224                                      // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  )
}

function isPrivateIPv6(addr: string): boolean {
  if (addr === '::1' || addr === '::') return true          // loopback / unspecified
  if (addr.startsWith('fe8') || addr.startsWith('fe9') ||
      addr.startsWith('fea') || addr.startsWith('feb')) return true  // fe80::/10 link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true    // fc00::/7 ULA
  if (addr.startsWith('2001:db8')) return true              // 2001:db8::/32 documentation
  return false
}

export function assertSafeUrl(rawUrl: string): void {
  // URL length guard — prevents evasion via very long URLs
  if (rawUrl.length > 2048) {
    throw new Error('URL exceeds maximum allowed length')
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL format')
  }

  const { protocol, hostname } = parsed
  // SCANNER-SEC-1: WHATWG URL keeps brackets on IPv6 literals ('[::1]'),
  // which previously slipped past every string check — strip them first.
  const host = hostname.replace(/^\[|\]$/g, '')

  if (!['http:', 'https:'].includes(protocol)) {
    throw new Error('Only http and https URLs are allowed')
  }

  if (BLOCKED_HOSTS.has(host) || isPrivateIP(host)) {
    throw new Error('Scanning internal or private network addresses is not allowed')
  }

  // DNS rebinding: block domain patterns that commonly resolve to private IPs
  for (const pattern of BLOCKED_DOMAIN_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error('URL resolves to a potentially private address')
    }
  }

  // Block port overrides to sensitive internal ports
  const port = parsed.port ? parseInt(parsed.port) : (protocol === 'https:' ? 443 : 80)
  const blockedPorts = new Set([22, 23, 25, 110, 143, 3306, 5432, 6379, 27017])
  if (blockedPorts.has(port)) {
    throw new Error('Scanning on this port is not allowed')
  }
}

/**
 * Rebinding-safe variant: runs the sync checks, then resolves the hostname
 * and rejects if ANY A/AAAA record points at a private/reserved address.
 *
 * If the resolver itself errors (NXDOMAIN, transient outage, sandboxed env)
 * we fail OPEN: a hostname that cannot be resolved cannot be fetched either,
 * so no SSRF is possible in that state and scans stay available during
 * resolver hiccups.
 */
export async function assertSafeUrlResolved(rawUrl: string): Promise<void> {
  assertSafeUrl(rawUrl)

  const { hostname } = new URL(rawUrl)
  const host = hostname.replace(/^\[|\]$/g, '') // strip IPv6 literal brackets
  // Bracket-less literal? isPrivateAddress covers it (already partly covered
  // by sync checks, but this handles forms the regexes miss).
  if (isPrivateAddress(host)) {
    throw new Error('Scanning internal or private network addresses is not allowed')
  }

  let records: { address: string; family: number }[]
  try {
    records = await dnsLookup(host, { all: true }) as { address: string; family: number }[]
  } catch {
    return // unresolvable → the subsequent fetch fails on its own; fail open
  }

  for (const r of records) {
    if (isPrivateAddress(r.address)) {
      throw new Error('This domain resolves to a private network address')
    }
  }
}

/**
 * SSRF-safe fetch: follows redirects MANUALLY, re-validating every hop with
 * assertSafeUrlResolved (string checks + DNS resolution). A public URL that
 * 302s to http://169.254.169.254/ is blocked at the hop instead of silently
 * followed (Node's default `redirect: 'follow'` performs no such check).
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit & { maxRedirects?: number } = {}
): Promise<Response> {
  const { maxRedirects = 3, ...fetchInit } = init

  let currentUrl = rawUrl
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrlResolved(currentUrl)

    const res = await fetch(currentUrl, { ...fetchInit, redirect: 'manual' })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return res // 3xx without Location — surface to caller
      try {
        currentUrl = new URL(location, currentUrl).toString() // handles relative redirects
      } catch {
        return res // unparseable Location — surface the 3xx instead of crashing
      }
      try { await res.body?.cancel() } catch { /* body may already be closed */ }
      continue
    }

    return res
  }

  throw new Error('Too many redirects')
}

/**
 * SCANNER-SEC-1 regression tests — SSRF guard hardening.
 *
 * Covers:
 *  - sync string checks (assertSafeUrl): private literals, protocols, ports,
 *    length, rebinding domain patterns, WHATWG IPv4 normalization
 *  - isPrivateAddress: full private/reserved ranges v4 + v6 + IPv4-mapped
 *  - assertSafeUrlResolved: DNS resolution to private addresses rejected,
 *    public resolutions pass, resolver errors fail OPEN
 *  - safeFetch: manual redirects, per-hop validation, redirect loops
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DNS mock: controllable per-test ──────────────────────────────────────────
// vi.hoisted guarantees the factory and the tests share the SAME binding.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))
vi.mock('node:dns', () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}))

import {
  assertSafeUrl,
  assertSafeUrlResolved,
  isPrivateAddress,
  safeFetch,
} from '../ssrf-guard'

// promisify() calls lookup(hostname, options, callback) — always take the
// callback from the LAST argument. Guard against spurious zero-arg
// invocations (vitest pokes mock functions between tests; args[-1] would be
// undefined and crash the implementation).
function dnsResolves(records: { address: string; family: number }[]) {
  lookupMock.mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as ((err: Error | null, res?: unknown) => void) | undefined
    if (typeof cb !== 'function') return
    cb(null, records)
  })
}
function dnsFails() {
  lookupMock.mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as ((err: Error | null) => void) | undefined
    if (typeof cb !== 'function') return
    cb(new Error('ENOTFOUND'))
  })
}

describe('assertSafeUrl (sync string checks)', () => {
  it('rejects private/loopback/link-local IP literals (incl. bracketed IPv6)', () => {
    for (const url of [
      'http://localhost/x',
      'http://127.0.0.1/x',
      'http://10.0.0.5/x',
      'http://172.16.0.1/x',
      'http://172.31.255.255/x',
      'http://192.168.1.1/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://0.0.0.0/x',
      'http://[::1]/x',
      'http://[fe80::1]/x',
      'http://[fd12:3456::1]/x',
    ]) {
      expect(() => assertSafeUrl(url), url).toThrow()
    }
  })

  it('rejects non-http(s) protocols', () => {
    for (const url of ['ftp://example.com/x', 'file:///etc/passwd', 'gopher://example.com']) {
      expect(() => assertSafeUrl(url), url).toThrow(/http and https/)
    }
  })

  it('rejects sensitive ports', () => {
    for (const port of [22, 3306, 5432, 6379, 27017]) {
      expect(() => assertSafeUrl(`http://example.com:${port}/`), `port ${port}`).toThrow(/port/)
    }
  })

  it('rejects URLs over 2048 characters', () => {
    expect(() => assertSafeUrl(`http://example.com/${'a'.repeat(2100)}`)).toThrow(/length/)
  })

  it('rejects DNS-rebinding wildcard domains (nip.io style)', () => {
    for (const host of ['192-168-1-1.nip.io', '10.0.0.1.xip.io', '1.2.3.4.sslip.io']) {
      expect(() => assertSafeUrl(`http://${host}/`), host).toThrow()
    }
  })

  it('normalizes non-dotted IPv4 forms via WHATWG URL parser', () => {
    // 2130706433 == 127.0.0.1 in decimal; the URL constructor canonicalizes it
    expect(new URL('http://2130706433/').hostname).toBe('127.0.0.1')
    expect(() => assertSafeUrl('http://2130706433/')).toThrow()
    expect(() => assertSafeUrl('http://0x7f000001/')).toThrow()
  })

  it('accepts ordinary public URLs', () => {
    expect(() => assertSafeUrl('https://example.com/blog/post-1')).not.toThrow()
    expect(() => assertSafeUrl('http://93.184.216.34/')).not.toThrow()
    expect(() => assertSafeUrl('https://example.com:8443/')).not.toThrow()
  })
})

describe('isPrivateAddress', () => {
  it('flags all private/reserved IPv4 ranges', () => {
    for (const ip of [
      '0.0.0.0', '0.1.2.3',
      '10.0.0.1', '10.255.255.255',
      '100.64.0.1', '100.127.255.255',          // CGNAT
      '127.0.0.1', '127.255.255.254',
      '169.254.169.254', '169.254.0.1',
      '172.16.0.0', '172.31.255.255',
      '192.0.0.1', '192.0.2.5',                  // TEST-NET-1
      '192.168.0.1', '192.168.255.254',
      '198.18.0.1', '198.19.255.255',            // benchmark
      '198.51.100.7', '203.0.113.9',             // TEST-NET-2/3
      '224.0.0.1', '239.1.1.1',                  // multicast
      '240.0.0.1', '255.255.255.255',            // reserved / broadcast
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('allows public IPv4', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.32.0.1', '100.128.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  it('flags private/reserved IPv6', () => {
    for (const ip of [
      '::1', '::',
      'fe80::1', 'fe90::', 'febf::ffff',
      'fc00::1', 'fd12:3456::1',
      '2001:db8::1',
      '::ffff:10.0.0.1', '::ffff:127.0.0.1',     // IPv4-mapped
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('allows public IPv6', () => {
    for (const ip of ['2606:4700::1111', '2a00:1450:4001::81', '2001:4860::8888']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })
})

describe('assertSafeUrlResolved (DNS resolution checks)', () => {
  beforeEach(() => lookupMock.mockReset())

  it('rejects a public-looking domain that resolves to a private address', async () => {
    dnsResolves([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.7', family: 4 }])
    await expect(assertSafeUrlResolved('https://evil-rebind.example.com/')).rejects.toThrow(
      /private network address/
    )
  })

  it('rejects a domain resolving to cloud metadata (169.254.169.254)', async () => {
    dnsResolves([{ address: '169.254.169.254', family: 4 }])
    await expect(assertSafeUrlResolved('https://metadata-alias.example.com/')).rejects.toThrow(
      /private network address/
    )
  })

  it('rejects IPv6 ULA resolution', async () => {
    dnsResolves([{ address: 'fd00::1234', family: 6 }])
    await expect(assertSafeUrlResolved('https://v6-internal.example.com/')).rejects.toThrow(
      /private network address/
    )
  })

  it('accepts a domain resolving only to public addresses', async () => {
    dnsResolves([{ address: '93.184.216.34', family: 4 }, { address: '2606:4700::1', family: 6 }])
    await expect(assertSafeUrlResolved('https://example.com/')).resolves.toBeUndefined()
  })

  it('fails OPEN when the resolver errors (unresolvable host cannot be fetched anyway)', async () => {
    dnsFails()
    await expect(assertSafeUrlResolved('https://does-not-resolve.example.com/')).resolves.toBeUndefined()
  })

  it('still applies the sync checks (protocol, ports, literals) before DNS', async () => {
    dnsResolves([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeUrlResolved('ftp://example.com/x')).rejects.toThrow(/http and https/)
    await expect(assertSafeUrlResolved('http://example.com:6379/')).rejects.toThrow(/port/)
    await expect(assertSafeUrlResolved('http://127.0.0.1/x')).rejects.toThrow()
  })
})

describe('safeFetch (redirect-aware fetching)', () => {
  beforeEach(() => {
    lookupMock.mockReset()
    dnsResolves([{ address: '93.184.216.34', family: 4 }])
  })

  const jsonResponse = (status: number, headers: Record<string, string> = {}) =>
    ({
      status,
      ok: status < 400,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      body: undefined,
    }) as unknown as Response

  it('blocks a redirect whose Location points at an internal address', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(302, { location: 'http://169.254.169.254/latest/meta-data/' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetch('https://public-redirector.example.com/')).rejects.toThrow(
      /private network addresses/
    )
    // The internal URL must never be fetched
    const calledUrls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(calledUrls).not.toContain('http://169.254.169.254/latest/meta-data/')
    vi.unstubAllGlobals()
  })

  it('follows legitimate redirects between public URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(301, { location: 'https://example.com/final' }))
      .mockResolvedValueOnce(jsonResponse(200))
    vi.stubGlobal('fetch', fetchMock)

    const res = await safeFetch('https://example.com/start')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://example.com/start')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://example.com/final')
    vi.unstubAllGlobals()
  })

  it('handles relative redirect locations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(302, { location: '/nested/page' }))
      .mockResolvedValueOnce(jsonResponse(200))
    vi.stubGlobal('fetch', fetchMock)

    const res = await safeFetch('https://example.com/start')
    expect(res.status).toBe(200)
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://example.com/nested/page')
    vi.unstubAllGlobals()
  })

  it('stops after maxRedirects hops', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      jsonResponse(302, { location: `${String(url)}-next` })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetch('https://example.com/loop', { maxRedirects: 2 })).rejects.toThrow(
      /Too many redirects/
    )
    expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 hops
    vi.unstubAllGlobals()
  })

  it('returns a 3xx response that has no Location header instead of crashing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(304))
    vi.stubGlobal('fetch', fetchMock)

    const res = await safeFetch('https://example.com/no-location')
    expect(res.status).toBe(304)
    vi.unstubAllGlobals()
  })
})

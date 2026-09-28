/**
 * SSRF Guard — block requests to private/internal IP ranges and loopback.
 * Call before any server-side fetch of user-supplied URLs.
 *
 * SEC-01 FIX: Added DNS rebinding mitigations — blocked domain patterns for
 * known internal TLDs and subdomain tricks, plus URL length limit.
 * String-only hostname checks can be bypassed via custom domains resolving to
 * private IPs. The patterns below block the most common DNS rebinding vectors.
 */

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

  if (!['http:', 'https:'].includes(protocol)) {
    throw new Error('Only http and https URLs are allowed')
  }

  if (BLOCKED_HOSTS.has(hostname) || isPrivateIP(hostname)) {
    throw new Error('Scanning internal or private network addresses is not allowed')
  }

  // DNS rebinding: block domain patterns that commonly resolve to private IPs
  for (const pattern of BLOCKED_DOMAIN_PATTERNS) {
    if (pattern.test(hostname)) {
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

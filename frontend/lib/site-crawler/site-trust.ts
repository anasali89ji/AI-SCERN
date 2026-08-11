// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Site Trust & Authority Scoring
// Transparency (contact/privacy/ToS presence), outbound Link Trust, and a
// simplified internal PageRank to catch "AI content buried deep" cloaking
// patterns. Pure JS, zero external calls except optional TLD checks (string
// matching only — no network).
// ════════════════════════════════════════════════════════════════════════════

const AUTHORITATIVE_TLDS = ['.gov', '.edu', '.org', '.mil']

// Small, static, illustrative blocklist of low-trust TLD patterns commonly
// abused by link-spam/PBN networks. Not exhaustive — a real deployment should
// swap this for a maintained bloom filter or third-party spam-domain feed.
const SUSPICIOUS_TLD_PATTERNS = [/\.top$/i, /\.xyz$/i, /\.click$/i, /\.gq$/i, /\.tk$/i, /\.link$/i, /\.loan$/i, /\.work$/i]

export interface TransparencySignals {
  hasContactPage:  boolean
  hasPrivacyPolicy: boolean
  hasTermsOfService: boolean
  hasPhysicalAddress: boolean
  score: number // 0-1
}

export function computeTransparencyScore(pages: { url: string; html: string; text: string }[]): TransparencySignals {
  const allText = pages.map(p => p.text.toLowerCase()).join(' ')
  const allUrls = pages.map(p => p.url.toLowerCase())

  const hasContactPage   = allUrls.some(u => /contact/.test(u)) || /contact us|get in touch/.test(allText)
  const hasPrivacyPolicy = allUrls.some(u => /privacy/.test(u)) || /privacy policy/.test(allText)
  const hasTermsOfService = allUrls.some(u => /terms/.test(u)) || /terms of service|terms and conditions/.test(allText)
  // Light heuristic for a physical address: street-suffix + digit sequence nearby
  const hasPhysicalAddress = /\b\d{1,5}\s+[a-z0-9.\s]{3,40}\b(street|st\.|avenue|ave\.|road|rd\.|suite|floor|blvd)/i.test(allText)

  const flags = [hasContactPage, hasPrivacyPolicy, hasTermsOfService, hasPhysicalAddress]
  const score = flags.filter(Boolean).length / flags.length

  return { hasContactPage, hasPrivacyPolicy, hasTermsOfService, hasPhysicalAddress, score: Math.round(score * 1000) / 1000 }
}

export function computeLinkTrustScore(pages: { html: string }[]): number {
  const outboundHosts: string[] = []
  for (const p of pages) {
    for (const m of p.html.matchAll(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["']/gi)) {
      try { outboundHosts.push(new URL(m[1]).hostname.toLowerCase()) } catch { /* skip */ }
    }
  }
  if (outboundHosts.length === 0) return 0.5 // neutral — no external data to judge

  let authoritative = 0, suspicious = 0
  for (const host of outboundHosts) {
    if (AUTHORITATIVE_TLDS.some(tld => host.endsWith(tld))) authoritative++
    if (SUSPICIOUS_TLD_PATTERNS.some(rx => rx.test(host))) suspicious++
  }
  const total = outboundHosts.length
  const raw = 0.5 + (authoritative / total) * 0.5 - (suspicious / total) * 0.7
  return Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 1000
}

// ── Simplified internal PageRank ────────────────────────────────────────────
// Flags pages that are high-AI-suspicion but structurally buried (low internal
// PageRank despite being linked from the sitemap) — a classic content-cloaking
// pattern where AI-spun pages are kept out of primary nav but still indexed.

export function computeInternalPageRank(
  pages: { url: string; links: string[] }[],
  iterations = 15,
  damping = 0.85,
): Map<string, number> {
  const urls = pages.map(p => p.url)
  const n = urls.length
  if (n === 0) return new Map()
  const idx = new Map(urls.map((u, i) => [u, i]))
  const outLinks: number[][] = pages.map(p =>
    [...new Set(p.links)].map(l => idx.get(l)).filter((v): v is number => v !== undefined)
  )

  let rank = new Array(n).fill(1 / n)
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Array(n).fill((1 - damping) / n)
    for (let i = 0; i < n; i++) {
      const outs = outLinks[i]
      if (outs.length === 0) {
        // dangling node — distribute its rank evenly (standard PageRank fix)
        const share = (damping * rank[i]) / n
        for (let j = 0; j < n; j++) next[j] += share
        continue
      }
      const share = (damping * rank[i]) / outs.length
      for (const j of outs) next[j] += share
    }
    rank = next
  }

  const result = new Map<string, number>()
  const max = Math.max(...rank, 1e-9)
  urls.forEach((u, i) => result.set(u, Math.round((rank[i] / max) * 1000) / 1000)) // normalise 0-1
  return result
}

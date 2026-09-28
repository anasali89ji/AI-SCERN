// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Site Trust & Authority Scoring
// Transparency, link trust, simplified PageRank
// ════════════════════════════════════════════════════════════════════════════

import type { DiscoveredLink, SiteTrustScore } from './types'

// Spam/shady domain patterns
const SPAM_TLDS = new Set(['.tk', '.ml', '.ga', '.cf', '.top', '.xyz', '.click', '.link', '.work'])
const AUTHORITY_TLDS = new Set(['.gov', '.edu', '.org', '.ac.uk', '.ac.jp', '.ac.in'])
const SPAM_PATTERNS = [
  /porn|xxx|adult|sex|casino|betting|poker|viagra|cialis/i,
  /free-money|get-rich|make-money-fast|work-from-home-scam/i,
]

// Common spam domains (simplified bloom filter approach)
const SPAM_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'short.link',
  'adf.ly', 'linkshrink.net', 'ouo.io', 'shorte.st',
])

function isSpamDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (SPAM_DOMAINS.has(lower)) return true
  for (const tld of SPAM_TLDS) {
    if (lower.endsWith(tld)) return true
  }
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(lower)) return true
  }
  return false
}

function isAuthorityDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  for (const tld of AUTHORITY_TLDS) {
    if (lower.endsWith(tld)) return true
  }
  // Known authority domains
  const authorities = [
    'wikipedia.org', 'wikimedia.org', 'nature.com', 'science.org',
    'ieee.org', 'arxiv.org', 'github.com', 'stackoverflow.com',
    'medium.com', 'substack.com', 'nytimes.com', 'bbc.com', 'reuters.com',
    'apnews.com', ' bloomberg.com', 'forbes.com', 'harvard.edu', 'mit.edu',
    'stanford.edu', 'ox.ac.uk', 'cam.ac.uk',
  ]
  return authorities.some(a => lower.includes(a))
}

/**
 * Analyze page content for transparency signals
 */
export function analyzeTransparency(pages: { url: string; textContent: string }[]): {
  hasContactPage: boolean
  hasPrivacyPolicy: boolean
  hasTermsOfService: boolean
  hasPhysicalAddress: boolean
  transparencyScore: number
} {
  let hasContactPage = false
  let hasPrivacyPolicy = false
  let hasTermsOfService = false
  let hasPhysicalAddress = false

  for (const page of pages) {
    const url = page.url.toLowerCase()
    const text = page.textContent.toLowerCase()

    if (/contact|reach us|get in touch|email us/i.test(url) ||
        /contact\s*(?:us|information|details)|reach\s*out|get\s*in\s*touch/i.test(text)) {
      hasContactPage = true
    }

    if (/privacy|privacy-policy|privacy_policy/i.test(url) ||
        /privacy\s*policy|data\s*protection|gdpr|ccpa/i.test(text)) {
      hasPrivacyPolicy = true
    }

    if (/terms|terms-of-service|terms_of_service|tos/i.test(url) ||
        /terms\s*(?:of\s*service|and\s*conditions)|legal\s*notice/i.test(text)) {
      hasTermsOfService = true
    }

    if (/\d+\s+[A-Za-z]+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|plaza)/i.test(text) ||
        /(?:new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|london|paris|berlin|tokyo|sydney|toronto|vancouver|mumbai|delhi|beijing|shanghai)/i.test(text)) {
      hasPhysicalAddress = true
    }
  }

  const score = (hasContactPage ? 0.25 : 0) +
    (hasPrivacyPolicy ? 0.25 : 0) +
    (hasTermsOfService ? 0.25 : 0) +
    (hasPhysicalAddress ? 0.25 : 0)

  return {
    hasContactPage,
    hasPrivacyPolicy,
    hasTermsOfService,
    hasPhysicalAddress,
    transparencyScore: Math.round(score * 100) / 100,
  }
}

/**
 * Analyze outbound link profile
 */
export function analyzeLinkTrust(links: DiscoveredLink[]): {
  authorityOutlinks: number
  spamOutlinks: number
  totalOutlinks: number
  linkTrustScore: number
} {
  const externalLinks = links.filter(l => !l.isInternal)
  let authorityOutlinks = 0
  let spamOutlinks = 0

  for (const link of externalLinks) {
    try {
      const hostname = new URL(link.url).hostname
      if (isAuthorityDomain(hostname)) authorityOutlinks++
      if (isSpamDomain(hostname)) spamOutlinks++
    } catch {}
  }

  const totalOutlinks = externalLinks.length

  // Score: more authority links = higher trust
  // Penalize spam links heavily
  let score = 0.5
  if (totalOutlinks > 0) {
    const authRatio = authorityOutlinks / totalOutlinks
    const spamRatio = spamOutlinks / totalOutlinks
    score = 0.3 + (authRatio * 0.5) - (spamRatio * 0.8)
  } else {
    // No external links is neutral for small sites, slightly negative for large ones
    score = 0.45
  }

  return {
    authorityOutlinks,
    spamOutlinks,
    totalOutlinks,
    linkTrustScore: Math.round(Math.max(0, Math.min(1, score)) * 100) / 100,
  }
}

/**
 * Simplified PageRank on internal link graph
 * Returns a score for each page URL
 */
export function computeInternalPageRank(
  pages: { url: string; links: DiscoveredLink[] }[],
  iterations = 15,
  damping = 0.85
): Record<string, number> {
  const urls = pages.map(p => p.url)
  const urlSet = new Set(urls)
  const n = urls.length
  if (n === 0) return {}
  if (n === 1) return { [urls[0]]: 1.0 }

  // Build adjacency list (internal links only)
  const outgoing: Record<string, string[]> = {}
  for (const page of pages) {
    outgoing[page.url] = page.links
      .filter(l => l.isInternal && urlSet.has(l.url))
      .map(l => l.url)
  }

  // Initialize scores
  let scores: Record<string, number> = {}
  for (const url of urls) scores[url] = 1 / n

  // Power iteration
  for (let iter = 0; iter < iterations; iter++) {
    const newScores: Record<string, number> = {}
    for (const url of urls) {
      let sum = 0
      for (const other of urls) {
        if (other === url) continue
        const outLinks = outgoing[other] || []
        if (outLinks.includes(url)) {
          const outCount = outLinks.length || 1
          sum += scores[other] / outCount
        }
      }
      newScores[url] = (1 - damping) / n + damping * sum
    }
    scores = newScores
  }

  // Normalize to 0-1
  const maxScore = Math.max(...Object.values(scores))
  if (maxScore > 0) {
    for (const url of urls) {
      scores[url] = Math.round((scores[url] / maxScore) * 1000) / 1000
    }
  }

  return scores
}

/**
 * Build complete site trust score
 */
export function buildSiteTrustScore(
  pages: { url: string; textContent: string; links: DiscoveredLink[] }[],
  isHttps: boolean
): SiteTrustScore {
  const transparency = analyzeTransparency(pages)
  const linkTrust = analyzeLinkTrust(pages.flatMap(p => p.links))
  const pageRank = computeInternalPageRank(pages)

  const sslScore = isHttps ? 80 : 10
  const domainAgeScore = 40 // placeholder — would need WHOIS lookup

  return {
    transparencyScore: transparency.transparencyScore,
    linkTrustScore: linkTrust.linkTrustScore,
    sslScore,
    domainAgeScore,
    hasContactPage: transparency.hasContactPage,
    hasPrivacyPolicy: transparency.hasPrivacyPolicy,
    hasTermsOfService: transparency.hasTermsOfService,
    hasPhysicalAddress: transparency.hasPhysicalAddress,
    authorityOutlinks: linkTrust.authorityOutlinks,
    spamOutlinks: linkTrust.spamOutlinks,
    internalPageRank: pageRank,
  }
}

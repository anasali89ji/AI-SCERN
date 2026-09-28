// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Site Scanner Forensics
// Pure-JS, dependency-free signal extractors used by site-scanner.ts to build
// the "forensic content authenticity" layer on top of the base text/image
// engines. Everything here runs on plain strings/buffers — safe for
// Node, Vercel Edge, or a Cloudflare Worker.
// ════════════════════════════════════════════════════════════════════════════

// ── SimHash (near-duplicate / "spun content" detection) ────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
}

function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 32-bit SimHash fingerprint of a text's word shingles — near-dupes hash to a low Hamming distance. */
export function simhash(text: string): number {
  const words = tokenize(text)
  const shingles: string[] = []
  for (let i = 0; i < words.length - 2; i++) shingles.push(words[i] + '_' + words[i + 1] + '_' + words[i + 2])
  if (shingles.length === 0) return hash32(text)

  const bits = new Array(32).fill(0)
  for (const sh of shingles) {
    const h = hash32(sh)
    for (let b = 0; b < 32; b++) bits[b] += (h & (1 << b)) ? 1 : -1
  }
  let fp = 0
  for (let b = 0; b < 32; b++) if (bits[b] > 0) fp |= (1 << b)
  return fp >>> 0
}

export function hammingDistance(a: number, b: number): number {
  let x = (a ^ b) >>> 0
  let count = 0
  while (x) { count += x & 1; x >>>= 1 }
  return count
}

/** Clusters pages whose SimHash differs by <=3 bits (near-duplicate / spun-content threshold). */
export function clusterDuplicates(fingerprints: { url: string; fp: number }[]): string[][] {
  const clusters: string[][] = []
  const assigned = new Set<string>()
  for (const item of fingerprints) {
    if (assigned.has(item.url)) continue
    const cluster = [item.url]
    assigned.add(item.url)
    for (const other of fingerprints) {
      if (assigned.has(other.url)) continue
      if (hammingDistance(item.fp, other.fp) <= 3) { cluster.push(other.url); assigned.add(other.url) }
    }
    if (cluster.length > 1) clusters.push(cluster)
  }
  return clusters
}

// ── Content Depth Score ─────────────────────────────────────────────────────

export function contentDepthScore(text: string): number {
  const words = tokenize(text)
  if (words.length === 0) return 0
  const trigrams = new Set<string>()
  for (let i = 0; i < words.length - 2; i++) trigrams.add(words[i] + '_' + words[i + 1] + '_' + words[i + 2])
  const uniqueTrigramRatio = words.length > 2 ? trigrams.size / (words.length - 2) : 0
  const lengthScore = Math.min(1, words.length / 600) // saturates around 600 words
  return Math.round(Math.min(1, lengthScore * 0.5 + uniqueTrigramRatio * 0.5) * 1000) / 1000
}

// ── Stylometry / Voice Diversity ────────────────────────────────────────────

export interface StyloProfile {
  meanSentenceLen: number
  typeTokenRatio:  number
  hapaxRate:       number
  punctuationRate: number
}

export function stylometricProfile(text: string): StyloProfile {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  const words = tokenize(text)
  const wc = words.length || 1

  const meanSentenceLen = sentences.length > 0
    ? sentences.reduce((s, sent) => s + sent.split(/\s+/).length, 0) / sentences.length
    : 0

  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1)
  const typeTokenRatio = freq.size / wc
  const hapaxRate = [...freq.values()].filter(c => c === 1).length / wc
  const punctuationRate = (text.match(/[,;:—–-]/g) || []).length / wc

  return { meanSentenceLen, typeTokenRatio, hapaxRate, punctuationRate }
}

/** 0 = every page reads identically (single-source/AI/template likely), 1 = strong natural voice variance. */
export function voiceDiversityIndex(profiles: StyloProfile[]): number {
  if (profiles.length < 2) return 1 // not enough pages to judge — don't penalize
  const dims: (keyof StyloProfile)[] = ['meanSentenceLen', 'typeTokenRatio', 'hapaxRate', 'punctuationRate']
  let totalCv = 0
  for (const dim of dims) {
    const vals = profiles.map(p => p[dim])
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const std  = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
    totalCv += mean > 0 ? std / mean : 0
  }
  const avgCv = totalCv / dims.length
  return Math.round(Math.min(1, avgCv / 0.6) * 1000) / 1000 // normalise: cv>=0.6 ~ fully diverse
}

// ── AI Artifact / Watermark Phrase Detection ────────────────────────────────

const AI_STOP_PHRASES = [
  'i hope this helps', "it's important to note that", 'it is important to note that',
  'as an ai language model', 'i cannot provide', "i don't have personal",
  'in the world of', 'unlock the power', 'unleash the power',
  '8k, highly detailed', 'unreal engine', 'trending on artstation', 'octane render',
  'digital art, highly detailed',
]

export interface AiArtifactHit { phrase: string; where: 'body' | 'alt_text' }

export function findAiArtifacts(bodyText: string, altTexts: string[]): AiArtifactHit[] {
  const hits: AiArtifactHit[] = []
  const lowerBody = bodyText.toLowerCase()
  for (const p of AI_STOP_PHRASES) if (lowerBody.includes(p)) hits.push({ phrase: p, where: 'body' })
  for (const alt of altTexts) {
    const lowerAlt = alt.toLowerCase()
    for (const p of AI_STOP_PHRASES) if (lowerAlt.includes(p)) hits.push({ phrase: p, where: 'alt_text' })
  }
  // Zero-width character watermarking check (ZWJ/ZWSP sequences sometimes used to fingerprint LLM output)
  if (/[\u200B\u200C\u200D\uFEFF]{2,}/.test(bodyText)) hits.push({ phrase: 'zero-width-character-sequence', where: 'body' })
  return hits
}

// ── EXIF heuristics (no external lib — scans raw JPEG bytes for ASCII tag strings) ──

export interface ExifFlags { flags: string[] }

export function scanExifFlags(buffer: Buffer): ExifFlags {
  const flags: string[] = []
  try {
    // Cheap approach: JPEG EXIF text fields (Software, Comment, Artist) are stored as
    // plain ASCII within the first ~64KB APP1 segment — a raw string scan catches them
    // without needing a full EXIF parser/dependency.
    const head = buffer.subarray(0, Math.min(buffer.length, 65536)).toString('latin1')
    const generatorMarkers = [
      'Stable Diffusion', 'ComfyUI', 'Midjourney', 'DALL-E', 'DALL·E', 'NovelAI',
      'Adobe Firefly', 'Leonardo.Ai', 'invokeai', 'AUTOMATIC1111',
    ]
    for (const marker of generatorMarkers) {
      if (head.includes(marker)) flags.push(`Software/Comment tag contains "${marker}"`)
    }
    // Self-contradictory EXIF: Apple "Make" tag combined with a non-Apple editing "Software" tag
    const hasAppleMake = /Apple/.test(head)
    const softwareMatch = head.match(/Software\x00*([\x20-\x7E]{3,40})/)
    if (hasAppleMake && softwareMatch && /photoshop|gimp|stable diffusion|comfyui/i.test(softwareMatch[1])) {
      flags.push(`Camera reports Apple hardware but Software tag = "${softwareMatch[1].trim()}"`)
    }
  } catch { /* non-JPEG or unparsable — no flags, not an error */ }
  return { flags }
}

// ── Site Trust Signals ──────────────────────────────────────────────────────

export interface TrustSignals {
  hasContactPage: boolean
  hasPrivacyPolicy: boolean
  hasTermsPage: boolean
  transparencyScore: number // 0-1
}

export function computeTransparency(allPageUrls: string[], allHtml: string[]): TrustSignals {
  const urlBlob = allPageUrls.join(' ').toLowerCase()
  const htmlBlob = allHtml.join(' ').toLowerCase()
  const hasContactPage    = /\/contact/.test(urlBlob) || /contact us|get in touch/.test(htmlBlob)
  const hasPrivacyPolicy  = /\/privacy/.test(urlBlob) || /privacy policy/.test(htmlBlob)
  const hasTermsPage      = /\/terms/.test(urlBlob) || /terms of service|terms & conditions|terms and conditions/.test(htmlBlob)
  const score = [hasContactPage, hasPrivacyPolicy, hasTermsPage].filter(Boolean).length / 3
  return { hasContactPage, hasPrivacyPolicy, hasTermsPage, transparencyScore: Math.round(score * 1000) / 1000 }
}

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.link', '.gq', '.tk', '.ml', '.cf']
const AUTHORITATIVE_TLDS = ['.gov', '.edu', '.org']

export function computeLinkTrust(outLinks: string[]): number {
  if (outLinks.length === 0) return 0.5 // neutral, not enough data
  let authoritative = 0
  let suspicious = 0
  for (const link of outLinks) {
    try {
      const host = new URL(link).hostname.toLowerCase()
      if (AUTHORITATIVE_TLDS.some(t => host.endsWith(t))) authoritative++
      if (SUSPICIOUS_TLDS.some(t => host.endsWith(t))) suspicious++
    } catch { /* skip */ }
  }
  const score = 0.5 + (authoritative / outLinks.length) * 0.5 - (suspicious / outLinks.length) * 0.5
  return Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000
}

// ── Lightweight internal PageRank (power iteration, small N so this is cheap) ──

export function lightweightPageRank(linkGraph: Map<string, string[]>, iterations = 15, damping = 0.85): Map<string, number> {
  const nodes = [...linkGraph.keys()]
  const n = nodes.length
  if (n === 0) return new Map()
  let ranks = new Map(nodes.map(u => [u, 1 / n]))

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Map(nodes.map(u => [u, (1 - damping) / n]))
    for (const u of nodes) {
      const outLinks = (linkGraph.get(u) || []).filter(l => linkGraph.has(l))
      if (outLinks.length === 0) continue
      const share = damping * (ranks.get(u) || 0) / outLinks.length
      for (const target of outLinks) next.set(target, (next.get(target) || 0) + share)
    }
    ranks = next
  }
  return ranks
}

// ── URL path-prefix grouping (for sitemap heatmap) ──────────────────────────

export function groupByPathPrefix(url: string): string {
  try {
    const path = new URL(url).pathname
    const parts = path.split('/').filter(Boolean)
    return parts.length > 0 ? `/${parts[0]}/` : '/'
  } catch { return '/' }
}

// ── WordPress plugin/theme fingerprinting (from asset URLs in page HTML) ───
// No external vulnerability DB call (keeps this free/offline) — flags a small
// known-name list of AI-content plugins directly; `hasVulnerability` is left
// as a placeholder field here for wiring a real WPScan feed later (see
// docs/SITE_SCANNER.md roadmap).

export interface WordPressAsset { slug: string; type: 'plugin' | 'theme'; isKnownAiContentTool: boolean }

const KNOWN_AI_CONTENT_PLUGIN_SLUGS = [
  'ai-content-writer', 'bertha-ai', 'wp-ai-content-generator', 'gpt-ai-power',
  'ai-power', 'chatbot-gpt', 'automatic-ai-content', 'wordai',
]

export function extractWordPressAssets(html: string): WordPressAsset[] {
  const found = new Map<string, WordPressAsset>()
  const rx = /wp-content\/(plugins|themes)\/([a-z0-9\-_]+)\//gi
  for (const m of html.matchAll(rx)) {
    const type = m[1].toLowerCase() === 'plugins' ? 'plugin' : 'theme'
    const slug = m[2].toLowerCase()
    const key = `${type}:${slug}`
    if (!found.has(key)) {
      found.set(key, { slug, type, isKnownAiContentTool: type === 'plugin' && KNOWN_AI_CONTENT_PLUGIN_SLUGS.includes(slug) })
    }
  }
  return [...found.values()]
}

// ── Integrity Seal (deterministic hash of scan result, no external deps) ───

export function computeIntegritySeal(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  // FNV-1a 64-bit-ish (two 32-bit lanes) — good enough for a non-cryptographic
  // "did this report change" seal; swap for crypto.subtle.digest if a
  // collision-resistant hash is required for real trust-badge verification.
  let h1 = 2166136261, h2 = 33554467
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i)
    h1 ^= c; h1 = Math.imul(h1, 16777619)
    h2 ^= c; h2 = Math.imul(h2, 486187739)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

// ════════════════════════════════════════════════════════════════════════════
// AISCERN — SimHash near-duplicate detection
// Detects "spun"/programmatic content: pages that are near-identical after
// light paraphrasing (classic AI/spinner content-farm pattern). Pure JS,
// zero external calls, zero deps.
// ════════════════════════════════════════════════════════════════════════════

// FNV-1a 32-bit hash — fast, deterministic, no deps.
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function shingles(text: string, n = 4): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length < n) return [words.join(' ')]
  const out: string[] = []
  for (let i = 0; i <= words.length - n; i++) out.push(words.slice(i, i + n).join(' '))
  return out
}

/** 64-bit SimHash represented as two 32-bit halves for portability (no BigInt requirement). */
export interface SimHash { hi: number; lo: number }

export function computeSimHash(text: string): SimHash {
  const bits = 64
  const v = new Array(bits).fill(0)
  const grams = shingles(text)
  for (const gram of grams) {
    // derive a 64-bit-ish hash by combining two 32-bit hashes of salted variants
    const h1 = fnv1a(gram)
    const h2 = fnv1a(gram + '\u0001salt')
    for (let b = 0; b < 32; b++) v[b]      += (h1 & (1 << b)) ? 1 : -1
    for (let b = 0; b < 32; b++) v[32 + b] += (h2 & (1 << b)) ? 1 : -1
  }
  let hi = 0, lo = 0
  for (let b = 0; b < 32; b++) if (v[b] > 0) lo |= (1 << b)
  for (let b = 0; b < 32; b++) if (v[32 + b] > 0) hi |= (1 << b)
  return { hi: hi >>> 0, lo: lo >>> 0 }
}

function popcount32(x: number): number {
  x = x - ((x >> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333)
  return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24
}

export function hammingDistance(a: SimHash, b: SimHash): number {
  return popcount32((a.hi ^ b.hi) >>> 0) + popcount32((a.lo ^ b.lo) >>> 0)
}

/** Similarity in [0,1] — 1.0 means identical fingerprint. */
export function simHashSimilarity(a: SimHash, b: SimHash): number {
  return 1 - hammingDistance(a, b) / 64
}

export interface DuplicateCluster {
  urls:        string[]
  avgSimilarity: number
}

/**
 * Clusters pages whose SimHash similarity exceeds `threshold` (default 0.90).
 * O(n^2) hamming comparisons — fine at the 60-page/scan cap this app enforces.
 */
export function clusterNearDuplicates(
  pages: { url: string; simhash: SimHash }[],
  threshold = 0.90,
): DuplicateCluster[] {
  const n = pages.length
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(x: number): number { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  function union(a: number, b: number) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }

  const pairSims: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = simHashSimilarity(pages[i].simhash, pages[j].simhash)
      if (sim >= threshold) { union(i, j); pairSims.push(sim) }
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(i)
  }

  const clusters: DuplicateCluster[] = []
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue
    let simSum = 0, simCount = 0
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        simSum += simHashSimilarity(pages[idxs[i]].simhash, pages[idxs[j]].simhash)
        simCount++
      }
    }
    clusters.push({
      urls: idxs.map(i => pages[i].url),
      avgSimilarity: simCount > 0 ? Math.round((simSum / simCount) * 1000) / 1000 : 1,
    })
  }
  return clusters
}

/** Content Depth Score: word count + unique-trigram ratio → 0 (thin) .. 1 (deep). */
export function contentDepthScore(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  const trigrams = new Set<string>()
  for (let i = 0; i <= words.length - 3; i++) trigrams.add(words.slice(i, i + 3).join(' '))
  const uniqueRatio = words.length >= 3 ? trigrams.size / (words.length - 2) : 0
  const lengthScore = Math.min(1, words.length / 500) // saturates at 500 words
  return Math.round(Math.min(1, lengthScore * 0.5 + uniqueRatio * 0.5) * 1000) / 1000
}

export const THIN_CONTENT_WORD_THRESHOLD = 150
export const THIN_CONTENT_DEPTH_THRESHOLD = 0.35

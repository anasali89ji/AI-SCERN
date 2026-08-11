// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Content Duplicity & Spin Detection
// SimHash fingerprinting, near-duplicate clustering, thin content detection
// ════════════════════════════════════════════════════════════════════════════

export interface DuplicityResult {
  fingerprint: string
  clusterId: number
  isSpun: boolean
  similarityToOthers: number // max similarity to any other page
  contentDepthScore: number // 0-1, higher = deeper/more original
  uniqueTrigrams: number
  totalTrigrams: number
  trigramRatio: number
}

export interface DuplicityCluster {
  clusterId: number
  pages: string[] // URLs
  avgSimilarity: number
  isSpun: boolean
}

/**
 * Generate a SimHash-like fingerprint from text
 * Uses character n-gram hashing for near-duplicate detection
 */
export function generateFingerprint(text: string): string {
  const cleaned = text.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()

  if (cleaned.length < 50) return 'short'

  // Generate 3-grams
  const grams: string[] = []
  const words = cleaned.split(/\s+/).filter(w => w.length > 2)
  for (let i = 0; i < words.length - 2; i++) {
    grams.push(`${words[i]}_${words[i+1]}_${words[i+2]}`)
  }

  if (grams.length === 0) return 'short'

  // Hash each gram and XOR into 64-bit buckets
  const buckets = new Uint32Array(4) // 128-bit fingerprint

  for (const gram of grams) {
    let hash = 0
    for (let i = 0; i < gram.length; i++) {
      hash = ((hash << 5) - hash) + gram.charCodeAt(i)
      hash |= 0
    }
    // Distribute hash bits across buckets
    const idx = Math.abs(hash) % 4
    buckets[idx] ^= Math.abs(hash)
  }

  return Array.from(buckets).map(b => (b >>> 0).toString(16).padStart(8, '0')).join('')
}

/**
 * Compute Hamming distance between two hex fingerprints
 */
function hammingDistance(fp1: string, fp2: string): number {
  if (fp1 === 'short' || fp2 === 'short') return 64
  if (fp1.length !== fp2.length) return 64

  let distance = 0
  for (let i = 0; i < fp1.length; i++) {
    const b1 = parseInt(fp1[i], 16)
    const b2 = parseInt(fp2[i], 16)
    let xor = b1 ^ b2
    while (xor) { distance += xor & 1; xor >>= 1 }
  }
  return distance
}

/**
 * Compute similarity between two fingerprints (0-1)
 */
function fingerprintSimilarity(fp1: string, fp2: string): number {
  const maxDist = fp1.length * 4 // max bits
  const dist = hammingDistance(fp1, fp2)
  return 1 - (dist / maxDist)
}

/**
 * Extract trigrams and compute uniqueness ratio
 */
function analyzeTrigrams(text: string): { unique: number; total: number; ratio: number } {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter(w => w.length > 1)

  if (words.length < 3) return { unique: 0, total: 0, ratio: 0 }

  const trigrams = new Set<string>()
  let total = 0

  for (let i = 0; i < words.length - 2; i++) {
    const tri = `${words[i]} ${words[i+1]} ${words[i+2]}`
    trigrams.add(tri)
    total++
  }

  return {
    unique: trigrams.size,
    total,
    ratio: total > 0 ? trigrams.size / total : 0,
  }
}

/**
 * Compute content depth score
 * Higher = more original, deeper content
 */
function computeContentDepth(wordCount: number, trigramRatio: number, sentenceVariety: number): number {
  // Word count component (diminishing returns after 1500)
  const wordScore = Math.min(1, wordCount / 1500)

  // Trigram uniqueness (higher = more original vocabulary)
  const trigramScore = Math.min(1, trigramRatio * 2)

  // Sentence variety (coefficient of variation of sentence lengths)
  const varietyScore = Math.min(1, sentenceVariety * 2)

  return Math.round((wordScore * 0.4 + trigramScore * 0.35 + varietyScore * 0.25) * 1000) / 1000
}

/**
 * Analyze all pages for duplicity and spin
 */
export function analyzeDuplicity(
  pages: { url: string; text: string; wordCount: number; sentenceCV: number }[]
): { results: Record<string, DuplicityResult>; clusters: DuplicityCluster[] } {
  const results: Record<string, DuplicityResult> = {}
  const fingerprints: { url: string; fp: string }[] = []

  // Generate fingerprints
  for (const page of pages) {
    const fp = generateFingerprint(page.text)
    const tri = analyzeTrigrams(page.text)
    const depth = computeContentDepth(page.wordCount, tri.ratio, page.sentenceCV)

    results[page.url] = {
      fingerprint: fp,
      clusterId: -1,
      isSpun: false,
      similarityToOthers: 0,
      contentDepthScore: depth,
      uniqueTrigrams: tri.unique,
      totalTrigrams: tri.total,
      trigramRatio: Math.round(tri.ratio * 1000) / 1000,
    }

    fingerprints.push({ url: page.url, fp })
  }

  // Cluster similar pages (single-linkage clustering)
  const SIMILARITY_THRESHOLD = 0.90
  const clusters: DuplicityCluster[] = []
  const assigned = new Set<string>()
  let nextClusterId = 0

  for (let i = 0; i < fingerprints.length; i++) {
    if (assigned.has(fingerprints[i].url)) continue

    const clusterUrls: string[] = [fingerprints[i].url]
    assigned.add(fingerprints[i].url)
    let maxSim = 0

    for (let j = i + 1; j < fingerprints.length; j++) {
      if (assigned.has(fingerprints[j].url)) continue
      const sim = fingerprintSimilarity(fingerprints[i].fp, fingerprints[j].fp)
      if (sim > SIMILARITY_THRESHOLD) {
        clusterUrls.push(fingerprints[j].url)
        assigned.add(fingerprints[j].url)
        maxSim = Math.max(maxSim, sim)
      }
    }

    if (clusterUrls.length > 1) {
      // Compute pairwise similarities for avg
      let totalSim = 0
      let pairs = 0
      for (let a = 0; a < clusterUrls.length; a++) {
        for (let b = a + 1; b < clusterUrls.length; b++) {
          const fpA = results[clusterUrls[a]].fingerprint
          const fpB = results[clusterUrls[b]].fingerprint
          totalSim += fingerprintSimilarity(fpA, fpB)
          pairs++
        }
      }

      const cluster: DuplicityCluster = {
        clusterId: nextClusterId,
        pages: clusterUrls,
        avgSimilarity: pairs > 0 ? totalSim / pairs : maxSim,
        isSpun: clusterUrls.length >= 2,
      }
      clusters.push(cluster)

      for (const url of clusterUrls) {
        results[url].clusterId = nextClusterId
        results[url].isSpun = true
      }
      nextClusterId++
    }
  }

  // Compute max similarity to any other page
  for (let i = 0; i < fingerprints.length; i++) {
    let maxSim = 0
    for (let j = 0; j < fingerprints.length; j++) {
      if (i === j) continue
      const sim = fingerprintSimilarity(fingerprints[i].fp, fingerprints[j].fp)
      maxSim = Math.max(maxSim, sim)
    }
    results[fingerprints[i].url].similarityToOthers = Math.round(maxSim * 1000) / 1000
  }

  return { results, clusters }
}

/**
 * Detect thin content (low depth score)
 */
export function isThinContent(depthScore: number, wordCount: number): boolean {
  return depthScore < 0.25 || wordCount < 80
}

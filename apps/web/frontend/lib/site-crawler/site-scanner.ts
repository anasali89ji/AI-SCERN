// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Full Site Scanner v2 ("Forensic Content Authenticity Platform")
//
// Wires the crawler (crawler.ts) to the SAME detection engines used by the
// single-file /api/detect/text and /api/detect/image routes, then layers on
// site-level forensic intelligence:
//   • Text  → analyzeText() + analyzeTextWithBrain()   (existing engines)
//   • Image → analyzeImage()                            (existing engine, Gemini-optional)
//   • Duplication/spin detection (simhash.ts)
//   • Stylometric Voice Diversity Index (stylometry.ts)
//   • AI artifact / watermark / prompt-residue hints (ai-artifacts.ts)
//   • Site trust: transparency, link trust, internal PageRank (site-trust.ts)
//   • WordPress deep scan: plugins/themes, AI-writer plugins, Gutenberg splice (wordpress-deep.ts)
//   • Section heatmap, remediation report, cryptographic Integrity Seal
//
// IMPORTANT — no hard Gemini/paid-API dependency for any of the above: every
// new module in this file is pure JS/regex/math running in-process. The only
// optional network calls (WPScan vuln lookup, Supabase seal persistence) are
// wrapped in try/catch and never block or fail the core scan.
// ════════════════════════════════════════════════════════════════════════════

import { analyzeText, analyzeImage } from '@/lib/inference/hf-analyze'
import { analyzeTextWithBrain }      from '@/lib/inference/text-detection-brain'
import { crawlSite, CrawlOptions, CrawledPage } from './crawler'
import { htmlToArticleText }         from './extract-article'
import {
  computeSimHash, clusterNearDuplicates, contentDepthScore,
  THIN_CONTENT_WORD_THRESHOLD, THIN_CONTENT_DEPTH_THRESHOLD, SimHash,
} from './simhash'
import { extractStyleVector, voiceDiversityIndex, StyleVector } from './stylometry'
import { detectAiArtifacts, extractAltAndCaptions, AiArtifactFindings } from './ai-artifacts'
import { computeTransparencyScore, computeLinkTrustScore, computeInternalPageRank } from './site-trust'
import { extractWordPressAssets, annotateVulnerabilities, WordPressPlugin } from './wordpress-deep'
import { issueIntegritySeal, IntegritySeal } from './integrity-seal'

// ── Public types ─────────────────────────────────────────────────────────────

export interface EnsembleSignals {
  hfEnsemble:      number
  linguisticBrain: number
  aiArtifactScore: number
  stylometricFlag: boolean   // this page's style vector is an outlier vs. the site average
  isSpun:          boolean   // part of a near-duplicate cluster
  isThinContent:   boolean
}

export interface PageTextVerdict {
  url:        string
  title:      string
  wordCount:  number
  aiScore:    number
  verdict:    'AI' | 'HUMAN' | 'UNCERTAIN'
  topFindings: string[]
  ensembleSignals: EnsembleSignals
  contentDepthScore: number
  pageRank?:  number
}

export interface PageImageVerdict {
  pageUrl:    string
  imageUrl:   string
  aiScore:    number
  verdict:    'AI' | 'HUMAN' | 'UNCERTAIN'
  modelUsed:  string
  error?:     string
}

export interface SectionHeatmapEntry {
  pathPrefix:       string
  aiContentPercent: number
  pageCount:        number
}

export interface RemediationItem {
  type:    'page' | 'image'
  url:     string
  action:  string
  reason:  string
}

export interface SiteScanResult {
  origin:            string
  isWordPress:       boolean
  discoveryMethod:   'sitemap' | 'link-crawl'
  pagesScanned:      number
  pagesFailed:       number

  aiContentPercent:  number
  aiImagePercent:    number
  totalTextWords:    number
  totalImagesFound:  number
  totalImagesScanned: number

  contentOriginalityScore: number
  voiceDiversityIndex:     number
  transparencyScore:       number
  linkTrustScore:          number
  duplicateClusters:       { urls: string[]; avgSimilarity: number }[]
  sectionsHeatmap:         SectionHeatmapEntry[]
  wordPressPlugins:        WordPressPlugin[]

  pages:   PageTextVerdict[]
  images:  PageImageVerdict[]
  remediation: RemediationItem[]
  integritySeal: IntegritySeal | null

  processingTimeMs: number
}

export interface SiteScanOptions extends CrawlOptions {
  includeImages?:       boolean
  maxImagesPerPage?:    number
  maxImagesTotal?:      number
  minWordsForTextScan?: number
  issueSeal?:           boolean
  checkWpVulnerabilities?: boolean
}

const SCAN_DEFAULTS = {
  includeImages:       true,
  maxImagesPerPage:    3,
  maxImagesTotal:      15,
  minWordsForTextScan: 60,
  issueSeal:           true,
  checkWpVulnerabilities: false,
}

function verdictFromScore(score: number): 'AI' | 'HUMAN' | 'UNCERTAIN' {
  return score > 0.65 ? 'AI' : score < 0.35 ? 'HUMAN' : 'UNCERTAIN'
}

async function fetchImageBuffer(url: string, timeoutMs = 10_000): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const arrayBuf = await res.arrayBuffer()
    if (arrayBuf.byteLength > 8 * 1024 * 1024) return null
    return { buffer: Buffer.from(arrayBuf), mimeType: contentType }
  } catch { return null }
}

interface PageAnalysisContext {
  page:      CrawledPage
  text:      string
  title:     string
  wordCount: number
  simhash:   SimHash
  styleVec:  StyleVector
  artifacts: AiArtifactFindings
  depth:     number
  textResult: Awaited<ReturnType<typeof analyzeText>>
  brainResult: ReturnType<typeof analyzeTextWithBrain>
}

async function buildPageContext(page: CrawledPage, minWords: number): Promise<PageAnalysisContext | null> {
  const { text, title } = htmlToArticleText(page.html)
  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (wordCount < minWords) return null

  const altTexts = extractAltAndCaptions(page.html)

  const [textResult, brainResult] = await Promise.all([
    analyzeText(text.slice(0, 50_000)),
    Promise.resolve(analyzeTextWithBrain(text.slice(0, 50_000))),
  ])

  return {
    page, text, title, wordCount,
    simhash:   computeSimHash(text),
    styleVec:  extractStyleVector(text),
    artifacts: detectAiArtifacts(text, altTexts),
    depth:     contentDepthScore(text),
    textResult, brainResult,
  }
}

function pathPrefixOf(url: string): string {
  try {
    const p = new URL(url).pathname
    const seg = p.split('/').filter(Boolean)[0]
    return seg ? `/${seg}/` : '/'
  } catch { return '/' }
}

async function scanPageImages(page: CrawledPage, maxPerPage: number, remainingBudget: number): Promise<PageImageVerdict[]> {
  const urls = page.imageUrls.slice(0, Math.min(maxPerPage, remainingBudget))
  const results = await Promise.allSettled(urls.map(async (imgUrl): Promise<PageImageVerdict> => {
    const fetched = await fetchImageBuffer(imgUrl)
    if (!fetched) return { pageUrl: page.url, imageUrl: imgUrl, aiScore: 0, verdict: 'UNCERTAIN', modelUsed: 'none', error: 'fetch_failed' }
    const det = await analyzeImage(fetched.buffer, fetched.mimeType, imgUrl.split('/').pop() || 'image.jpg')
    return {
      pageUrl:   page.url,
      imageUrl:  imgUrl,
      aiScore:   Math.round(det.confidence * 1000) / 1000,
      verdict:   verdictFromScore(det.confidence),
      modelUsed: det.model_used,
    }
  }))
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { pageUrl: page.url, imageUrl: urls[i], aiScore: 0, verdict: 'UNCERTAIN', modelUsed: 'error', error: String(r.reason) }
  )
}

export async function scanSite(startUrl: string, options: SiteScanOptions = {}): Promise<SiteScanResult> {
  const start = Date.now()
  const opts  = { ...SCAN_DEFAULTS, ...options }

  const crawl = await crawlSite(startUrl, opts)

  const contexts = (await Promise.all(crawl.pages.map(p => buildPageContext(p, opts.minWordsForTextScan))))
    .filter((c): c is PageAnalysisContext => c !== null)

  const dupClusters = clusterNearDuplicates(contexts.map(c => ({ url: c.page.url, simhash: c.simhash })))
  const spunUrls = new Set(dupClusters.flatMap(c => c.urls))

  const vdi = voiceDiversityIndex(contexts.map(c => c.styleVec))

  const styleOutlierFlags = (() => {
    if (contexts.length < 3) return new Map<string, boolean>()
    const dims = contexts.map(c => [
      Math.min(1, c.styleVec.meanSentenceLen / 40), c.styleVec.ttr, c.styleVec.hapaxRate,
    ])
    const centroid = dims[0].map((_, i) => dims.reduce((s, d) => s + d[i], 0) / dims.length)
    const dists = dims.map(d => Math.sqrt(d.reduce((s, v, i) => s + (v - centroid[i]) ** 2, 0)))
    const meanDist = dists.reduce((a, b) => a + b, 0) / dists.length
    const flags = new Map<string, boolean>()
    contexts.forEach((c, i) => flags.set(c.page.url, dists[i] < meanDist * 0.3))
    return flags
  })()

  const pageRanks = computeInternalPageRank(contexts.map(c => ({ url: c.page.url, links: c.page.linkedUrls })))

  const pageVerdicts: PageTextVerdict[] = contexts.map(c => {
    const blended = Math.min(0.99, Math.max(0.01,
      c.textResult.confidence * 0.55 + c.brainResult.score * 0.30 + c.artifacts.score * 0.15
    ))
    return {
      url:        c.page.url,
      title:      c.title,
      wordCount:  c.wordCount,
      aiScore:    Math.round(blended * 1000) / 1000,
      verdict:    verdictFromScore(blended),
      topFindings: [
        ...(c.brainResult.findings ?? []).slice(0, 3),
        ...(c.artifacts.stopPhrasesFound.length > 0 ? [`AI stop-phrase found: "${c.artifacts.stopPhrasesFound[0]}"`] : []),
        ...(spunUrls.has(c.page.url) ? ['Near-duplicate of another page on this site (possible spun content)'] : []),
      ].slice(0, 5),
      ensembleSignals: {
        hfEnsemble:      Math.round(c.textResult.confidence * 1000) / 1000,
        linguisticBrain: Math.round(c.brainResult.score * 1000) / 1000,
        aiArtifactScore: c.artifacts.score,
        stylometricFlag: styleOutlierFlags.get(c.page.url) ?? false,
        isSpun:          spunUrls.has(c.page.url),
        isThinContent:   c.wordCount < THIN_CONTENT_WORD_THRESHOLD || c.depth < THIN_CONTENT_DEPTH_THRESHOLD,
      },
      contentDepthScore: c.depth,
      pageRank: pageRanks.get(c.page.url),
    }
  })

  const images: PageImageVerdict[] = []
  let totalImagesFound = 0
  if (opts.includeImages) {
    let budget = opts.maxImagesTotal
    for (const page of crawl.pages) {
      totalImagesFound += page.imageUrls.length
      if (budget <= 0) continue
      const pageResults = await scanPageImages(page, opts.maxImagesPerPage, budget)
      images.push(...pageResults)
      budget -= pageResults.length
    }
  } else {
    totalImagesFound = crawl.pages.reduce((sum, p) => sum + p.imageUrls.length, 0)
  }

  let wordPressPlugins: WordPressPlugin[] = []
  if (crawl.isWordPress) {
    const assetMap = new Map<string, WordPressPlugin>()
    for (const page of crawl.pages) {
      for (const asset of extractWordPressAssets(page.html)) assetMap.set(`${asset.source}:${asset.slug}`, asset)
    }
    wordPressPlugins = [...assetMap.values()]
    if (opts.checkWpVulnerabilities) {
      try { wordPressPlugins = await annotateVulnerabilities(wordPressPlugins) } catch { /* non-fatal */ }
    }
  }

  const aiPages   = pageVerdicts.filter(p => p.verdict === 'AI').length
  const aiImages  = images.filter(i => i.verdict === 'AI' && !i.error).length
  const validImgs = images.filter(i => !i.error).length

  const aiContentPercent = pageVerdicts.length > 0 ? Math.round((aiPages / pageVerdicts.length) * 1000) / 10 : 0
  const aiImagePercent   = validImgs > 0 ? Math.round((aiImages / validImgs) * 1000) / 10 : 0

  const contentOriginalityScore = pageVerdicts.length > 0
    ? Math.round((1 - spunUrls.size / pageVerdicts.length) * 1000) / 1000
    : 1
  const transparencySignals = computeTransparencyScore(contexts.map(c => ({ url: c.page.url, html: c.page.html, text: c.text })))
  const linkTrustScore = computeLinkTrustScore(crawl.pages.map(p => ({ html: p.html })))

  const sectionMap = new Map<string, { ai: number; total: number }>()
  for (const p of pageVerdicts) {
    const prefix = pathPrefixOf(p.url)
    const entry = sectionMap.get(prefix) ?? { ai: 0, total: 0 }
    entry.total++
    if (p.verdict === 'AI') entry.ai++
    sectionMap.set(prefix, entry)
  }
  const sectionsHeatmap: SectionHeatmapEntry[] = [...sectionMap.entries()]
    .map(([pathPrefix, { ai, total }]) => ({ pathPrefix, aiContentPercent: Math.round((ai / total) * 1000) / 10, pageCount: total }))
    .sort((a, b) => b.aiContentPercent - a.aiContentPercent)

  const remediation: RemediationItem[] = []
  for (const p of pageVerdicts) {
    if (p.verdict === 'AI') {
      const reasons: string[] = []
      if (p.ensembleSignals.isSpun) reasons.push('near-duplicate of another page (spun content)')
      if (p.ensembleSignals.isThinContent) reasons.push('thin content (low depth/word count)')
      if (p.ensembleSignals.aiArtifactScore > 0.3) reasons.push('AI phrase/watermark artifacts detected')
      if ((p.pageRank ?? 1) < 0.15) reasons.push('buried deep in site structure despite AI content (possible cloaking)')
      remediation.push({
        type: 'page', url: p.url,
        action: p.ensembleSignals.isSpun ? 'Merge or remove duplicate; rewrite remaining copy manually' : 'Rewrite content manually',
        reason: reasons.length > 0 ? `Likely AI-generated — ${reasons.join('; ')}` : 'Likely AI-generated based on ensemble score',
      })
    }
  }
  for (const img of images) {
    if (img.verdict === 'AI' && !img.error) {
      remediation.push({ type: 'image', url: img.imageUrl, action: 'Replace or verify provenance', reason: `Image detection engine (${img.modelUsed}) flagged this as AI-generated` })
    }
  }

  let integritySeal: IntegritySeal | null = null
  if (opts.issueSeal) {
    try {
      integritySeal = await issueIntegritySeal(crawl.origin, {
        pagesScanned: pageVerdicts.length,
        aiContentPercent, aiImagePercent, contentOriginalityScore, voiceDiversityIndex: vdi,
      })
    } catch { integritySeal = null }
  }

  return {
    origin:           crawl.origin,
    isWordPress:      crawl.isWordPress,
    discoveryMethod:  crawl.discoveryMethod,
    pagesScanned:      crawl.pages.length,
    pagesFailed:       crawl.pages.filter(p => !p.fetchedOk).length,

    aiContentPercent,
    aiImagePercent,
    totalTextWords:    pageVerdicts.reduce((s, p) => s + p.wordCount, 0),
    totalImagesFound,
    totalImagesScanned: validImgs,

    contentOriginalityScore,
    voiceDiversityIndex: vdi,
    transparencyScore:   transparencySignals.score,
    linkTrustScore,
    duplicateClusters:   dupClusters,
    sectionsHeatmap,
    wordPressPlugins,

    pages:  pageVerdicts,
    images,
    remediation,
    integritySeal,

    processingTimeMs: Date.now() - start,
  }
}

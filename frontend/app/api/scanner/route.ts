// ════════════════════════════════════════════════════════════════════════════
// AISCERN — /api/scanner — Complete Site Forensic Scanner
// Wires: crawler + text brain + image brain + trust + WordPress + duplicity
// Zero paid APIs required — runs on free fetch + local computation
// ════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { crawlSite } from '@/lib/scanner/crawler'
import { analyzeText, computeContentOriginality } from '@/lib/scanner/engines'
import { analyzeDuplicity } from '@/lib/scanner/duplicity'
import { analyzeImagesBatch } from '@/lib/scanner/image-forensics'
import { deepWordPressScan } from '@/lib/scanner/wordpress'
import { buildSiteTrustScore } from '@/lib/scanner/trust'
import { computeVoiceDiversityIndex } from '@/lib/scanner/stylometry'
import type {
  SiteScanResult, ScannedPage, ScannedImage, SectionHeatmap,
  RemediationItem, ContentIntegritySeal, TimelineComparison,
} from '@/lib/scanner/types'

// Rate limiting (simple in-memory)
const rateLimit = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60000 // 1 minute
  const maxRequests = 5

  const entry = rateLimit.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

/**
 * Generate integrity seal hash
 */
function generateIntegritySeal(result: SiteScanResult): ContentIntegritySeal {
  const payload = JSON.stringify({
    origin: result.origin,
    domain: result.domain,
    pagesScanned: result.pagesScanned,
    aiContentPercent: result.aiContentPercent,
    aiImagePercent: result.aiImagePercent,
    timestamp: Date.now(),
  })

  // Simple hash (in production, use crypto.subtle.digest)
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  const hashHex = Math.abs(hash).toString(16).padStart(16, '0')

  return {
    hash: hashHex,
    timestamp: new Date().toISOString(),
    verificationUrl: `https://aiscern.vercel.app/verify/${hashHex}`,
  }
}

/**
 * Build remediation report
 */
function buildRemediation(
  pages: ScannedPage[],
  images: ScannedImage[],
  wpPlugins: { slug: string; name?: string; aiRelated: boolean }[]
): RemediationItem[] {
  const items: RemediationItem[] = []

  // Page remediation
  for (const page of pages) {
    if (page.verdict === 'AI' && page.aiScore > 0.75) {
      items.push({
        type: 'page',
        url: page.url,
        action: 'Rewrite content manually — high AI probability',
        reason: `AI score ${(page.aiScore * 100).toFixed(0)}% with ${page.topFindings.slice(0, 2).join(', ')}`,
        priority: page.aiScore > 0.9 ? 'critical' : 'high',
      })
    } else if (page.isSpun) {
      items.push({
        type: 'page',
        url: page.url,
        action: 'Review for duplicate/spun content',
        reason: 'Detected as part of a spun content cluster',
        priority: 'high',
      })
    } else if (page.isThinContent) {
      items.push({
        type: 'page',
        url: page.url,
        action: 'Expand with original, in-depth content',
        reason: 'Thin content detected (low depth score)',
        priority: 'medium',
      })
    }
  }

  // Image remediation
  for (const img of images) {
    if (img.verdict === 'AI' && img.aiScore > 0.7) {
      items.push({
        type: 'image',
        imageUrl: img.url,
        action: 'Replace with authentic photography or properly disclose AI generation',
        reason: `${img.modelUsed} indicates ${(img.aiScore * 100).toFixed(0)}% AI probability. ${img.exifFlags.slice(0, 2).join(', ')}`,
        priority: img.aiScore > 0.9 ? 'critical' : 'high',
      })
    }
  }

  // Plugin remediation
  for (const plugin of wpPlugins) {
    if (plugin.aiRelated) {
      items.push({
        type: 'plugin',
        pluginSlug: plugin.slug,
        action: 'Review AI-generated content from this plugin',
        reason: `AI content plugin detected: ${plugin.name || plugin.slug}`,
        priority: 'medium',
      })
    }
  }

  return items.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  }).slice(0, 50)
}

/**
 * Build section heatmap
 */
function buildSectionHeatmap(pages: ScannedPage[]): SectionHeatmap[] {
  const sections: Record<string, { scores: number[]; words: number[] }> = {}

  for (const page of pages) {
    try {
      const path = new URL(page.url).pathname
      const parts = path.split('/').filter(Boolean)
      const prefix = parts.length > 0 ? `/${parts[0]}/` : '/'

      if (!sections[prefix]) sections[prefix] = { scores: [], words: [] }
      sections[prefix].scores.push(page.aiScore)
      sections[prefix].words.push(page.wordCount)
    } catch {}
  }

  return Object.entries(sections)
    .map(([pathPrefix, data]) => ({
      pathPrefix,
      pageCount: data.scores.length,
      avgAiScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 1000) / 1000,
      aiContentPercent: Math.round((data.scores.filter(s => s >= 0.5).length / data.scores.length) * 1000) / 10,
      totalWords: data.words.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.pageCount - a.pageCount)
}

/**
 * Build timeline comparison (placeholder for future re-scans)
 */
function buildTimeline(): TimelineComparison {
  return {
    isRescan: false,
    newAiPages: [],
    scoreJumps: [],
    contentVelocity: 0,
    pagesRemoved: [],
    pagesAdded: [],
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // Rate limit
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 5 scans per minute.' },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const url = body.url?.trim()

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL. Must start with http:// or https://' },
        { status: 400 }
      )
    }

    // Normalize URL
    let targetUrl = url
    if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`
    targetUrl = targetUrl.replace(/\/$/, '')

    const domain = new URL(targetUrl).hostname
    const isHttps = targetUrl.startsWith('https://')

    // ── CRAWL ──
    const crawlResult = await crawlSite(targetUrl, {
      maxPages: body.maxPages || 30,
      maxImagesTotal: body.maxImagesTotal || 20,
      maxDepth: body.maxDepth || 2,
      priorityBFS: true,
      includeImageAnalysis: true,
      scanImages: true,
    })

    if (crawlResult.pages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not fetch any pages from this site. The site may block crawlers or require JavaScript.' },
        { status: 400 }
      )
    }

    // ── WORDPRESS DEEP SCAN (on homepage) ──
    const wpInfo = deepWordPressScan(crawlResult.pages[0]?.rawHtml || '', targetUrl)

    // ── TEXT ANALYSIS (Phase 1: stylometry for all pages) ──
    const allStylometries = crawlResult.pages.map(p => {
      const { analyzeStylometry } = require('@/lib/scanner/stylometry')
      return analyzeStylometry(p.textContent)
    })

    // ── TEXT ANALYSIS (Phase 2: full ensemble per page) ──
    const scannedPages: ScannedPage[] = []
    for (let i = 0; i < crawlResult.pages.length; i++) {
      const page = crawlResult.pages[i]
      const result = await analyzeText(
        {
          text: page.textContent,
          wordCount: page.wordCount,
          contentType: page.contentType,
          headings: page.headings,
        },
        allStylometries
      )

      scannedPages.push({
        url: page.url,
        title: page.title,
        description: page.description,
        textContent: page.textContent.slice(0, 3000),
        wordCount: page.wordCount,
        contentType: page.contentType,
        headings: page.headings,
        imageUrls: page.imageUrls,
        links: page.links,
        fetchMethod: page.fetchMethod,
        publishDate: page.publishDate,
        author: page.author,
        language: page.language,
        metaKeywords: page.metaKeywords,
        ...result,
      })
    }

    // ── DUPLICITY ANALYSIS (site-wide) ──
    const duplicityInput = scannedPages.map(p => ({
      url: p.url,
      text: p.textContent,
      wordCount: p.wordCount,
      sentenceCV: p.stylometry.sentenceLengthCV,
    }))
    const { results: duplicityResults, clusters: duplicityClusters } = analyzeDuplicity(duplicityInput)

    // Update pages with duplicity results
    for (const page of scannedPages) {
      const dup = duplicityResults[page.url]
      if (dup) {
        page.isSpun = dup.isSpun
        page.contentDepthScore = dup.contentDepthScore
        page.ensembleSignals.isSpun = dup.isSpun
        page.ensembleSignals.isThinContent = page.isThinContent || isThinContent(dup.contentDepthScore, page.wordCount)
      }
    }

    // ── IMAGE ANALYSIS ──
    const uniqueImages = [...new Set(crawlResult.allImages.map(i => i.url))].slice(0, 20)
    const scannedImages = uniqueImages.length > 0
      ? await analyzeImagesBatch(uniqueImages, 5)
      : []

    // ── TRUST SCORING ──
    const siteTrust = buildSiteTrustScore(
      crawlResult.pages.map(p => ({
        url: p.url,
        textContent: p.textContent,
        links: p.links,
      })),
      isHttps
    )

    // ── AGGREGATE METRICS ──
    const textScores = scannedPages.map(p => p.aiScore)
    const aiContentPercent = textScores.length > 0
      ? Math.round((textScores.filter(s => s >= 0.5).length / textScores.length) * 1000) / 10
      : 0

    const imageScores = scannedImages.map(i => i.aiScore)
    const aiImagePercent = imageScores.length > 0
      ? Math.round((imageScores.filter(s => s >= 0.5).length / imageScores.length) * 1000) / 10
      : 0

    const humanContentPercent = textScores.length > 0
      ? Math.round((textScores.filter(s => s <= 0.35).length / textScores.length) * 1000) / 10
      : 0

    const uncertainContentPercent = Math.round((100 - aiContentPercent - humanContentPercent) * 10) / 10

    const contentOriginality = computeContentOriginality(duplicityResults)
    const voiceDiversity = computeVoiceDiversityIndex(allStylometries)

    // ── BUILD RESULT ──
    const result: SiteScanResult = {
      success: true,
      origin: targetUrl,
      domain,
      isWordPress: wpInfo.isWordPress,
      wordPressInfo: wpInfo,
      discoveryMethod: 'crawl',
      pagesScanned: scannedPages.length,
      maxPages: body.maxPages || 30,
      aiContentPercent,
      aiImagePercent,
      humanContentPercent,
      uncertainContentPercent,
      totalImagesAnalyzed: scannedImages.length,
      aiImagesCount: scannedImages.filter(i => i.verdict === 'AI').length,
      realImagesCount: scannedImages.filter(i => i.verdict === 'HUMAN').length,
      contentOriginalityScore: contentOriginality,
      voiceDiversityIndex: voiceDiversity,
      transparencyScore: siteTrust.transparencyScore,
      linkTrustScore: siteTrust.linkTrustScore,
      siteTrustScore: siteTrust,
      sectionsHeatmap: buildSectionHeatmap(scannedPages),
      timeline: buildTimeline(),
      wordPressPlugins: wpInfo.plugins,
      pages: scannedPages,
      images: scannedImages,
      remediation: buildRemediation(scannedPages, scannedImages, wpInfo.plugins),
      integritySeal: generateIntegritySeal({} as SiteScanResult), // will be regenerated below
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'ensemble:linguistic+perplexity+stylometry+artifacts+ela+dct+exif',
      fetchStats: crawlResult.fetchStats,
    }

    // Generate integrity seal with full result
    result.integritySeal = generateIntegritySeal(result)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Scanner error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown scanner error',
        processingTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// Helper
function isThinContent(depthScore: number, wordCount: number): boolean {
  return depthScore < 0.25 || wordCount < 80
}

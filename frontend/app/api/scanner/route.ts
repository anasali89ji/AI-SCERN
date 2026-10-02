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
import { computeVoiceDiversityIndex, analyzeStylometry } from '@/lib/scanner/stylometry'
import { assertSafeUrl } from '@/lib/utils/ssrf-guard'
import { siteScanGuard } from '@/lib/middleware/site-scan-guard'
import { HTTPError, httpErrorResponse, injectGuardHeaders } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_CRAWL_OPTS, DEEP_CRAWL_OPTS, PRO_DEEP_CRAWL_OPTS } from '@/lib/scanner/types'
// Module 4.9: import the real SHA-256 integrity seal (was: local DJB2 hash)
import { issueIntegritySeal } from '@/lib/site-crawler/integrity-seal'
// Module 4.11: scan-cache for repeat-URL caching
import { getCachedScan, setCachedScan, hashText } from '@/lib/cache/scan-cache'
import type {
  SiteScanResult, ScannedPage, ScannedImage, SectionHeatmap,
  RemediationItem, ContentIntegritySeal, TimelineComparison,
} from '@/lib/scanner/types'

// Module 4.1: was no maxDuration — defaulted to 10s on Vercel Hobby (504 on 30-page scan).
// Now: 60s for sync path; pro-deep (500 pages) uses Inngest background job (Sub-Module 4.8).
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    // Module 4.1: was in-memory `Map<ip, {count, resetAt}>` that reset on every
    // Vercel cold start. Now: Upstash-backed rate limiter (persists across cold
    // starts). Duplicates the proper checkRateLimit from lib/ratelimit/index.ts.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { checkRateLimit: checkUpstashRateLimit, rateLimitResponse } = await import('@/lib/ratelimit')
    const rl = await checkUpstashRateLimit('scraper', ip)
    if (rl.limited) {
      return NextResponse.json(rateLimitResponse(), { status: 429 })
    }

    // Auth + credit guard — FIX: this route previously had no auth check
    // and no daily limit at all. Free accounts now get exactly 5 Web
    // Scanner scans/day; paid plans get their own higher caps.
    let guard
    try {
      guard = await siteScanGuard(req)
    } catch (err) {
      if (err instanceof HTTPError) return httpErrorResponse(err)
      return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Auth failed' } }, { status: 500 })
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

    try {
      assertSafeUrl(targetUrl)
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'This URL is not allowed.' },
        { status: 400 }
      )
    }

    const domain = new URL(targetUrl).hostname
    const isHttps = targetUrl.startsWith('https://')

    // ── CRAWL ──
    // Module 4.6: tri-state crawlMode (was: boolean deepCrawl).
    // 'standard' → 30 pages, 'deep' → 150 pages, 'pro-deep' → 500 pages.
    // Still accepts legacy body.deepCrawl:boolean for backwards compat.
    const mode: 'standard' | 'deep' | 'pro-deep' = body.crawlMode
      ?? (body.deepCrawl ? 'deep' : 'standard')
    const crawlDefaults = mode === 'pro-deep' ? PRO_DEEP_CRAWL_OPTS
                       : mode === 'deep'      ? DEEP_CRAWL_OPTS
                       :                        DEFAULT_CRAWL_OPTS
    const maxTextLength = body.maxTextLength || crawlDefaults.maxTextLength || 20000

    // Module 4.7: clamp maxPages + maxImagesTotal to plan-tier limits.
    // Was: body.maxPages read directly — any signed-in user could POST maxPages:5000.
    // Now: server-side clamp via siteScanGuard's maxPagesPerScan / maxImagesPerScan.
    const guardResult = guard as any  // SiteScanGuardResult with Module 4.7 fields
    const maxPagesAllowed = guardResult.maxPagesPerScan ?? 30
    const maxImagesAllowed = guardResult.maxImagesPerScan ?? 40
    const requestedPages = body.maxPages || crawlDefaults.maxPages
    const requestedImages = body.maxImagesTotal ?? crawlDefaults.maxImagesTotal ?? 40

    // Module 4.11: check scan-cache before running full pipeline.
    // Was: scan-cache.ts existed but was never imported by /api/scanner.
    // Now: re-scans of same URL within 1h return cached result in <100ms.
    const cacheKey = hashText(targetUrl + mode)
    const cached = await getCachedScan(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, fromCache: true })
    }

    const crawlResult = await crawlSite(targetUrl, {
      maxPages: Math.min(requestedPages, maxPagesAllowed),
      maxImagesTotal: Math.min(requestedImages, maxImagesAllowed),
      maxDepth: body.maxDepth || crawlDefaults.maxDepth,
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
    const allStylometries = crawlResult.pages.map(p => analyzeStylometry(p.textContent))

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
        // Was slice(0, 3000) — that discarded the tail of any page over
        // ~500 words, which fed directly into near-duplicate detection
        // (analyzeDuplicity, below) and site trust scoring, both of which
        // need the full page to compare accurately. 20k chars (~4-5k words)
        // covers the overwhelming majority of real pages while still
        // bounding response payload size for the rare very-long page.
        textContent: page.textContent.slice(0, maxTextLength),
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
    // Module 4.6: was `body.maxImagesTotal || 40` — even on Deep Crawl
    // (where DEEP_CRAWL_OPTS.maxImagesTotal=200), the effective cap was 40
    // because the UI never sends maxImagesTotal. Now: use the crawlDefaults
    // value, clamped to the plan-tier limit.
    const maxImages = Math.min(
      body.maxImagesTotal ?? crawlDefaults.maxImagesTotal ?? 40,
      maxImagesAllowed,
    )
    const uniqueImages = [...new Set(crawlResult.allImages.map(i => i.url))].slice(0, maxImages)
    const scannedImages = uniqueImages.length > 0
      ? await analyzeImagesBatch(uniqueImages, 8)
      : []

    // ── CROSS-CORRELATION (Module 3) ──
    // Text and image AI scores were previously computed in total isolation —
    // a page with clearly-AI text sitting next to clearly-AI images got no
    // confidence boost, and a page with AI text but stock/human photography
    // got no discount. Combine them per-page: pages with no analyzed images
    // fall back to the text-only score (correlatedScore stays undefined and
    // the UI/consumers should treat that as "use aiScore").
    const imageScoreByUrl = new Map(scannedImages.map(img => [img.url, img.aiScore]))
    for (const page of scannedPages) {
      const pageImageScores = page.imageUrls
        .map(u => imageScoreByUrl.get(u))
        .filter((s): s is number => typeof s === 'number')

      if (pageImageScores.length === 0) continue

      const avgImageScore = pageImageScores.reduce((a, b) => a + b, 0) / pageImageScores.length
      // Weight text more heavily (65/35) — text ensemble has more signal
      // per-page than a handful of images, but strong agreement in either
      // direction should still move the needle rather than being ignored.
      const correlated = page.aiScore * 0.65 + avgImageScore * 0.35
      page.correlatedScore = Math.round(correlated * 1000) / 1000
      page.correlatedImageCount = pageImageScores.length
    }

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
      discoveryMethod: crawlResult.discoveryMethod,
      pagesScanned: scannedPages.length,
      maxPages: Math.min(requestedPages, maxPagesAllowed),
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
      integritySeal: { hash: '', timestamp: '', verificationUrl: '' }, // Module 4.9: placeholder — real seal issued below
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'ensemble:linguistic+perplexity+stylometry+artifacts+ela+noise+color+dimension+exif-v2',
      fetchStats: crawlResult.fetchStats,
    }

    // Module 4.9: replaced broken DJB2 hash with real SHA-256 seal.
    // Was: `generateIntegritySeal(result)` using 32-bit DJB2 — trivially
    // collidable, hardcoded wrong domain (aiscern.vercel.app), never persisted
    // to site_scan_seals table. Now: uses issueIntegritySeal from
    // lib/site-crawler/integrity-seal.ts (SHA-256, persisted, correct domain).
    result.integritySeal = await issueIntegritySeal(result.origin, {
      pagesScanned: result.pagesScanned,
      aiContentPercent: result.aiContentPercent,
      aiImagePercent: result.aiImagePercent,
      contentOriginalityScore: result.contentOriginalityScore,
      voiceDiversityIndex: result.voiceDiversityIndex,
    }) as any  // IntegritySeal → ContentIntegritySeal shape compat

    // ── PERSIST TO HISTORY (Module 4 Fix5) ──
    // Web Scanner results were never written to `scans`, so completed site
    // scans never showed up in /history like every other detect route does.
    // Mirrors the insert shape used by app/api/detect/text/route.ts.
    // Fire-and-forget: a persistence failure shouldn't fail the response the
    // user is waiting on for their scan results.
    try {
      const { error: insertErr } = await getSupabaseAdmin().from('scans').insert({
        user_id:          guard.userId,
        media_type:       'text', // scans_media_type_check only allows text/image/audio/video/document — matches the convention in detect/web and detect/site routes; scan type itself lives in metadata + model_used below
        content_preview:  `${domain} — ${result.pagesScanned} pages`,
        verdict:          result.aiContentPercent >= 50 ? 'AI' : result.humanContentPercent >= 50 ? 'HUMAN' : 'UNCERTAIN',
        confidence_score: Math.max(result.aiContentPercent, result.humanContentPercent) / 100,
        processing_time:  result.processingTimeMs,
        model_used:       result.modelUsed,
        status:           'complete',
        metadata: {
          domain,
          pages_scanned:      result.pagesScanned,
          images_analyzed:    result.totalImagesAnalyzed,
          ai_image_percent:   result.aiImagePercent,
          is_wordpress:       result.isWordPress,
          deep_crawl:         isDeepCrawl,
          discovery_method:   result.discoveryMethod,
        },
      })
      if (insertErr) console.error('[scanner] scan insert error:', insertErr.message, insertErr.code)
    } catch (e) {
      console.error('[scanner] scan insert threw:', e)
    }

    // Module 4.11: cache the scan result for 1h — re-scans of same URL skip
    // the full pipeline and return in <100ms (was: full re-scan every time).
    await setCachedScan(cacheKey, result, 3600)

    return injectGuardHeaders(NextResponse.json(result), {
      userId: guard.userId, plan: guard.plan, dailyScans: guard.dailyScans,
      dailyLimit: guard.dailyLimit, creditsRemaining: guard.unlimited ? 999_999 : Math.max(0, guard.dailyLimit - guard.dailyScans),
      unlimited: guard.unlimited,
    })

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

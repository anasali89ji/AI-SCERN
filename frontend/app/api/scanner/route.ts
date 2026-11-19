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
import { aggregateVerdictMix, aiImagePercent } from '@/lib/scanner/aggregate'
import { assertSafeUrlResolved } from '@/lib/utils/ssrf-guard'
import {
  getSiteScanUser, getSiteScanPlanContext, getSiteScanDailyUsage, siteScanGuard,
} from '@/lib/middleware/site-scan-guard'
import { HTTPError, httpErrorResponse, injectGuardHeaders } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_CRAWL_OPTS, DEEP_CRAWL_OPTS, PRO_DEEP_CRAWL_OPTS } from '@/lib/scanner/types'
// Module 4.9: import the real SHA-256 integrity seal (was: local DJB2 hash)
import { issueIntegritySeal } from '@/lib/site-crawler/integrity-seal'
// Module 4.11: scan-cache for repeat-URL caching
import { getCachedScan, setCachedScan, hashText } from '@/lib/cache/scan-cache'
import type {
  SiteScanResult, ScannedPage, ScannedImage, SectionHeatmap,
  RemediationItem, TimelineComparison,
} from '@/lib/scanner/types'

// Module 4.1: was no maxDuration — defaulted to 10s on Vercel Hobby (504 on 30-page scan).
// Now: 60s for sync path; pro-deep (500 pages) uses Inngest background job (Sub-Module 4.8).
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// SCAN-PERF-1: bounded concurrency for the per-page text ensemble. 4 keeps
// CPU flat under the route's 60s budget while cutting wall time ~3-4x on
// 150-500-page scans (analyzeText is pure-JS, ~1-3ms/page).
const TEXT_ANALYSIS_CONCURRENCY = 4

/**
 * Run analyzeText over all pages with bounded concurrency while PRESERVING
 * input order (results are index-assigned, not array-raced). A failure on
 * one page yields a neutral-scored placeholder that is excluded from the
 * verdict mix (verdict stays undefined) instead of failing the whole scan.
 */
async function analyzeAllPages(
  pages: Parameters<typeof analyzeText>[0] extends never ? never : import('@/lib/scanner/crawler').ParsedPage[],
  allStylometries: ReturnType<typeof analyzeStylometry>[],
): Promise<ScannedPage[]> {
  const scannedPages: ScannedPage[] = new Array(pages.length)
  let cursor = 0

  async function worker() {
    while (cursor < pages.length) {
      const i = cursor++
      const page = pages[i]
      try {
        const result = await analyzeText(
          {
            text: page.textContent,
            wordCount: page.wordCount,
            contentType: page.contentType,
            headings: page.headings,
          },
          allStylometries,
        )
        scannedPages[i] = {
          url: page.url,
          title: page.title,
          description: page.description,
          textContent: page.textContent.slice(0, 20_000),
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
        } as ScannedPage
      } catch (e) {
        console.warn(`[scanner] analyzeText failed for ${page.url}:`, e)
        // Honest failure placeholder — excluded from verdict mix by
        // aggregateVerdictMix (no verdict field).
        scannedPages[i] = {
          url: page.url,
          title: page.title,
          description: page.description,
          textContent: '',
          wordCount: page.wordCount ?? 0,
          contentType: page.contentType ?? 'other',
          headings: [],
          imageUrls: [],
          links: [],
          fetchMethod: page.fetchMethod ?? 'direct',
          aiScore: 0,
          verdict: undefined as unknown as ScannedPage['verdict'],
          confidence: 0,
          ensembleSignals: {} as ScannedPage['ensembleSignals'],
          topFindings: ['Text analysis failed for this page'],
          stylometry: {} as ScannedPage['stylometry'],
          aiArtifacts: [],
          sentenceScores: [],
          isSpun: false,
          isThinContent: false,
          contentDepthScore: 0,
          perplexityScore: 0.5,
        } as ScannedPage
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(TEXT_ANALYSIS_CONCURRENCY, pages.length) }, () => worker()),
  )
  return scannedPages
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
 * Build section heatmap. SCAN-AGG-1: "AI share" per section is the share of
 * pages whose VERDICT is AI — the same threshold as the page cards and the
 * site summary (was: raw score >= 0.5, disagreeing with both).
 */
function buildSectionHeatmap(pages: ScannedPage[]): SectionHeatmap[] {
  const sections: Record<string, { scores: number[]; words: number[]; ai: number }> = {}

  for (const page of pages) {
    try {
      const path = new URL(page.url).pathname
      const parts = path.split('/').filter(Boolean)
      const prefix = parts.length > 0 ? `/${parts[0]}/` : '/'

      if (!sections[prefix]) sections[prefix] = { scores: [], words: [], ai: 0 }
      sections[prefix].scores.push(page.aiScore)
      sections[prefix].words.push(page.wordCount)
      if (page.verdict === 'AI') sections[prefix].ai++
    } catch {}
  }

  return Object.entries(sections)
    .map(([pathPrefix, data]) => ({
      pathPrefix,
      pageCount: data.scores.length,
      avgAiScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 1000) / 1000,
      aiContentPercent: Math.round((data.ai / data.scores.length) * 1000) / 10,
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

/**
 * Persist a scan row to /history for the requesting user (fresh scans AND
 * cache hits — a completed site scan belongs in the user's history either
 * way). Non-fatal: history failures must not erase the scan result.
 */
async function insertScanHistory(
  userId: string,
  domain: string,
  result: Pick<SiteScanResult, 'pagesScanned' | 'aiContentPercent' | 'humanContentPercent' | 'aiImagePercent' | 'totalImagesAnalyzed' | 'isWordPress' | 'discoveryMethod' | 'processingTimeMs' | 'modelUsed'>,
  mode: string,
  fromCache: boolean,
): Promise<void> {
  try {
    const { error: insertErr } = await getSupabaseAdmin().from('scans').insert({
      user_id:          userId,
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
        deep_crawl:         mode !== 'standard',
        discovery_method:   result.discoveryMethod,
        from_cache:         fromCache,
      },
    })
    if (insertErr) console.error('[scanner] scan insert error:', insertErr.message, insertErr.code)
  } catch (e) {
    console.error('[scanner] scan insert threw:', e)
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

    // ── 1. AUTH (SCAN-QUOTA-1: auth-only first — no quota mutation yet) ──
    let userId: string
    try {
      ({ userId } = await getSiteScanUser(req))
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
      // SCANNER-SEC-1: resolved variant — also rejects domains whose DNS
      // records point at private/internal addresses (string checks alone
      // can be bypassed with a custom domain).
      await assertSafeUrlResolved(targetUrl)
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

    // ── 2. PLAN CONTEXT (non-mutating — SCAN-QUOTA-1/SCAN-CACHE-1) ──
    // Resolve plan + caps BEFORE touching quota or cache so that:
    //  (a) the cache key is scoped to the plan's effective caps — a free
    //      user can never be served a cached 500-page pro-deep result;
    //  (b) a cache hit doesn't need the incrementing RPC at all.
    const planCtx = await getSiteScanPlanContext(userId)
    const maxPagesAllowed = planCtx.maxPagesPerScan ?? 30
    const maxImagesAllowed = planCtx.maxImagesPerScan ?? 40
    const requestedPages = body.maxPages || crawlDefaults.maxPages
    const requestedImages = body.maxImagesTotal ?? crawlDefaults.maxImagesTotal ?? 40

    // Effective caps — what the scan WILL actually analyze. Part of the
    // cache key: two users with different entitlements never share results.
    const effectivePages = Math.min(requestedPages, maxPagesAllowed)
    const effectiveImages = Math.min(requestedImages, maxImagesAllowed)

    // ── 3. CACHE LOOKUP (before quota — SCAN-QUOTA-1) ──
    // Semantics (documented contract): a cache hit performs no new work, so
    // it consumes NO daily-scan credit, but it DOES create a history row for
    // the requesting user and re-issues the integrity seal in their name.
    const cacheKey = hashText(`${targetUrl}|${mode}|${effectivePages}|${effectiveImages}`)
    const cached = await getCachedScan<SiteScanResult>(cacheKey)
    if (cached && cached.success) {
      // Strip the ORIGINAL requester's seal from the shared cache payload
      // (SCAN-CACHE-1: seals are user-specific artifacts; the cached copy
      // must not leak another user's seal number to a different account).
      const shared: SiteScanResult = { ...cached, fromCache: true }
      shared.integritySeal = { hash: '', timestamp: '', verificationUrl: '' }

      // Re-issue the seal for THIS user from the cached metrics (non-fatal).
      try {
        shared.integritySeal = await issueIntegritySeal(shared.origin, {
          pagesScanned: shared.pagesScanned,
          aiContentPercent: shared.aiContentPercent,
          aiImagePercent: shared.aiImagePercent,
          contentOriginalityScore: shared.contentOriginalityScore,
          voiceDiversityIndex: shared.voiceDiversityIndex,
        }) as any
        const { issueSealForSiteScan, sealVerifyUrl: buildSealUrl } = await import('@/lib/seal/issue')
        const sealHash = (shared.integritySeal as any)?.hash || ''
        if (sealHash) {
          const sealNumber = await issueSealForSiteScan(sealHash, userId, shared.origin, shared.pagesScanned)
          ;(shared.integritySeal as any).sealNumber = sealNumber
          ;(shared.integritySeal as any).sealVerifyUrl = buildSealUrl(sealNumber)
        }
      } catch (e) { console.warn('[scanner] cache-hit seal reissue failed:', e) }

      // History row for the requesting user (from_cache: true).
      await insertScanHistory(userId, domain, shared, mode, true)

      const dailyScans = await getSiteScanDailyUsage(userId)
      return injectGuardHeaders(NextResponse.json(shared), {
        userId, plan: planCtx.plan, dailyScans,
        dailyLimit: planCtx.dailyLimit, creditsRemaining: planCtx.unlimited ? 999_999 : Math.max(0, planCtx.dailyLimit - dailyScans),
        unlimited: planCtx.unlimited,
      })
    }

    // ── 4. QUOTA (incrementing RPC — cache miss only) ──
    let guard
    try {
      guard = await siteScanGuard(req)
    } catch (err) {
      if (err instanceof HTTPError) return httpErrorResponse(err)
      return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Quota check failed' } }, { status: 500 })
    }

    const crawlResult = await crawlSite(targetUrl, {
      maxPages: effectivePages,
      maxImagesTotal: effectiveImages,
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

    // ── TEXT ANALYSIS (Phase 2: full ensemble per page, bounded concurrency —
    // SCAN-PERF-1; was: sequential await in a for loop) ──
    const scannedPages = await analyzeAllPages(crawlResult.pages, allStylometries)

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
    // value, clamped to the plan-tier limit (effectiveImages, computed above).
    const maxImages = effectiveImages
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

    // ── AGGREGATE METRICS (SCAN-AGG-1: verdict-based, consistent with the
    // per-page cards; was: raw-score >= 0.5 disagreeing with the 0.65/0.35
    // verdict thresholds) ──
    const mix = aggregateVerdictMix(scannedPages)
    const aiContentPercent = mix.aiContentPercent
    const humanContentPercent = mix.humanContentPercent
    const uncertainContentPercent = mix.uncertainContentPercent
    const aiImagePercentValue = aiImagePercent(scannedImages)

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
      maxPages: effectivePages,
      aiContentPercent,
      aiImagePercent: aiImagePercentValue,
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
    result.integritySeal = await issueIntegritySeal(result.origin, {
      pagesScanned: result.pagesScanned,
      aiContentPercent: result.aiContentPercent,
      aiImagePercent: result.aiImagePercent,
      contentOriginalityScore: result.contentOriginalityScore,
      voiceDiversityIndex: result.voiceDiversityIndex,
    }) as any  // IntegritySeal → ContentIntegritySeal shape compat

    // Issue a user-facing seal number (ASC-XXXXXXXX-XX format) for the site scan.
    // This populates the seal_number column in site_scan_seals so /api/verify/seal/[sealNumber]
    // can look it up. Non-fatal — the scan result is returned regardless.
    let siteSealNumber: string | null = null
    try {
      const { issueSealForSiteScan, sealVerifyUrl: buildSealUrl } = await import('@/lib/seal/issue')
      const sealHash = (result.integritySeal as any)?.hash || ''
      if (sealHash) {
        siteSealNumber = await issueSealForSiteScan(
          sealHash, guard.userId, result.origin, result.pagesScanned
        )
        ;(result.integritySeal as any).sealNumber = siteSealNumber
        ;(result.integritySeal as any).sealVerifyUrl = buildSealUrl(siteSealNumber)
      }
    } catch (e) { console.warn('[scanner] site seal issuance failed:', e) }

    // ── PERSIST TO HISTORY (Module 4 Fix5) ──
    // Web Scanner results were never written to `scans`, so completed site
    // scans never showed up in /history like every other detect route does.
    await insertScanHistory(guard.userId, domain, result, mode, false)

    // Module 4.11: cache the scan result for 1h — re-scans of same URL skip
    // the full pipeline and return in <100ms (was: full re-scan every time).
    // SCAN-CACHE-1: the cached copy is the SHARED site-content payload.
    // User-specific fields are stripped before caching so a cache hit never
    // serves another user's seal; the cache-hit path re-issues a fresh seal.
    const cacheable: SiteScanResult = { ...result }
    cacheable.integritySeal = { hash: '', timestamp: '', verificationUrl: '' }
    await setCachedScan(cacheKey, cacheable, 3600)

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

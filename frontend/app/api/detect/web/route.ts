// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Web Scanner / Blog Post AI Detection
// POST /api/detect/web
//
// Fetches a URL, extracts full text via Jina Reader, then runs:
//   1. Text Detection Brain (AI phrase fingerprints, sentence burstiness...)
//   2. Blog Post Pattern Analysis (transition phrases, uniform paragraphs,
//      header density, personal anecdote absence, readability uniformity,
//      excessive hedging, listicle structures, zero original opinion)
//   3. Full text ensemble (hf-analyze text pipeline)
//   4. Graph RAG web context (cross-reference with similar content)
//
// Also detects AI images embedded in the page when image URLs are found.
//
// Request:  POST { url: string, includeImages?: boolean }
// Response: DetectionResult + blog_pattern + page_meta
// ════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse }    from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { analyzeText }                  from '@/lib/inference/hf-analyze'
import { analyzeTextWithBrain }         from '@/lib/inference/text-detection-brain'
import { fetchPageContent }             from '@/lib/utils/fetch-page'
import { getSupabaseAdmin }             from '@/lib/supabase/admin'
import { runSemanticRAG }               from '@/lib/forensic/layers/semantic-rag'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

// ── Image URL Extraction ───────────────────────────────────────────────────────
// Extracts up to 5 image URLs from raw HTML: og:image, twitter:image, then <img> tags.
// Max 5 per scan for cost control. Skips tiny icons/tracking pixels.

function extractImageUrls(html: string, _pageUrl: string): string[] {
  const urls: Set<string> = new Set()

  // Priority 1: og:image meta tag
  const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/)
                ?? html.match(/content="([^"]+)"\s+property="og:image"/)
  if (ogMatch?.[1]) urls.add(ogMatch[1])

  // Priority 2: twitter:image
  const twMatch = html.match(/name="twitter:image"\s+content="([^"]+)"/)
                ?? html.match(/content="([^"]+)"\s+name="twitter:image"/)
  if (twMatch?.[1]) urls.add(twMatch[1])

  // Priority 3: regular <img> tags — only absolute URLs, only common image formats
  if (urls.size < 5) {
    const imgMatches = html.matchAll(/src="(https?:\/\/[^"]{10,500}\.(jpg|jpeg|png|webp))(?:\?[^"]*)?"(?:[^>]{0,100})?>/gi)
    for (const m of imgMatches) {
      if (urls.size >= 5) break
      const src = m[1]
      // Skip tracking pixels, icons, logos (heuristic: path contains 'icon', 'logo', 'pixel', '1x1')
      if (/icon|logo|pixel|1x1|avatar|emoji/i.test(src)) continue
      urls.add(src)
    }
  }

  return [...urls].slice(0, 5)
}

// ── Web Scanner Image Analysis ─────────────────────────────────────────────────
// Runs the 9-agent semantic RAG on each image URL found on the scanned page.
// Max 5 images per scan (cost control per Part IX constraint 5).

interface PageImageResult {
  url:           string
  aiScore:       number
  generator?:    string
  agentsSummary: string
  error?:        string
}

async function analyzePageImages(imageUrls: string[]): Promise<PageImageResult[]> {
  const results = await Promise.allSettled(
    imageUrls.map(async (url): Promise<PageImageResult> => {
      const { layerReport, agents, generatorAttribution } = await runSemanticRAG(url)

      return {
        url,
        aiScore:    layerReport.layerSuspicionScore,
        generator:  generatorAttribution ?? undefined,
        agentsSummary: agents
          .filter(a => a.agentSuspicionScore > 0.6 && a.modelUsed !== 'failed')
          .map(a => `${a.agentName}(${a.agentSuspicionScore.toFixed(2)})`)
          .join(', ') || 'No strong signals',
      }
    })
  )

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { url: imageUrls[i], aiScore: 0.5, agentsSummary: 'Analysis failed', error: String((r as PromiseRejectedResult).reason) }
  )
}

// ── Blog Post Pattern Analyzer ─────────────────────────────────────────────────
// Detects structural and linguistic AI patterns specific to blog posts / articles.

interface BlogPatternResult {
  score:         number   // 0–1 AI probability from blog patterns alone
  signals:       { name: string; score: number; evidence: string }[]
  ai_phrases:    string[]  // specific AI phrases found
  verdict:       'AI_BLOG' | 'LIKELY_AI' | 'HUMAN_WRITTEN' | 'UNCERTAIN'
}

function analyzeBlogPatterns(content: string): BlogPatternResult {
  const signals: { name: string; score: number; evidence: string }[] = []
  const contentLower = content.toLowerCase()

  // ── 1. AI Transition Phrases ──────────────────────────────────────────────
  // These phrases appear statistically much more in AI content
  const strongAIPhrases = [
    "it's worth noting", "it is worth noting", "it is important to note",
    'in conclusion,', 'in summary,', 'to summarize,', 'as we have seen',
    "let's explore", "let's dive into", "let's delve into",
    'in this comprehensive', 'this comprehensive guide', 'this in-depth',
    'in the ever-evolving', "in today's fast-paced", "in today's digital",
    'revolutionizing the way', 'game-changing', 'state-of-the-art solutions',
    'harness the power of', 'leverage the power', 'unlock the potential',
    'seamlessly integrate', 'cutting-edge technology', 'robust solutions',
    'transformative impact', 'paradigm shift', 'moving forward,',
    'at the end of the day,', 'when all is said and done',
    'it goes without saying', 'needless to say,',
  ]
  const moderateAIPhrases = [
    'furthermore,', 'moreover,', 'additionally,', 'consequently,',
    'in addition,', 'on the other hand,', 'having said that,',
    'with that being said,', 'that being said,',
    'first and foremost,', 'last but not least,',
    'a myriad of', 'a plethora of', 'tapestry of', 'underpinning',
    'multifaceted', 'holistic approach', 'nuanced understanding',
    'delve into', 'dive deep', 'foster collaboration',
    'actionable insights', 'best practices', 'key takeaways',
  ]

  const foundStrong   = strongAIPhrases.filter(p => contentLower.includes(p))
  const foundModerate = moderateAIPhrases.filter(p => contentLower.includes(p))
  const allFound      = [...foundStrong.map(p => `STRONG: "${p}"`), ...foundModerate.slice(0, 8).map(p => `"${p}"`)]

  const phraseScore = foundStrong.length >= 5 ? 0.94 : foundStrong.length >= 3 ? 0.82 : foundStrong.length >= 1 ? 0.65 :
                      foundModerate.length >= 8 ? 0.78 : foundModerate.length >= 5 ? 0.62 : 0.22
  signals.push({ name: 'AI Transition Phrases', score: phraseScore, evidence: `${foundStrong.length} strong, ${foundModerate.length} moderate AI phrases found` })

  // ── 2. Paragraph Uniformity ───────────────────────────────────────────────
  const paragraphs  = content.split(/\n{2,}/).filter(p => p.trim().length > 60)
  const wordCounts  = paragraphs.map(p => p.split(/\s+/).length)
  if (wordCounts.length >= 3) {
    const m   = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
    const std = Math.sqrt(wordCounts.reduce((a, b) => a + (b - m) ** 2, 0) / wordCounts.length)
    const cv  = m > 0 ? std / m : 1
    // AI blogs: very uniform paragraph lengths (cv < 0.25)
    const uniformScore = cv < 0.20 ? 0.90 : cv < 0.32 ? 0.74 : cv < 0.48 ? 0.48 : 0.18
    signals.push({ name: 'Paragraph Length Uniformity', score: uniformScore, evidence: `CV=${cv.toFixed(3)} (AI: <0.32, Real: >0.48) across ${paragraphs.length} paragraphs` })
  }

  // ── 3. Header/Structure Density ───────────────────────────────────────────
  const h2h3Count    = (content.match(/^#{2,3} .+$/gm) || []).length
  const wordCount    = content.split(/\s+/).length
  const headerRatio  = wordCount > 0 ? h2h3Count / (wordCount / 300) : 0  // headers per 300 words
  // AI blogs: 1+ headers per 300 words; Real: < 0.5
  const headerScore  = headerRatio > 1.5 ? 0.86 : headerRatio > 1.0 ? 0.70 : headerRatio > 0.6 ? 0.50 : 0.20
  signals.push({ name: 'Header Density', score: headerScore, evidence: `${h2h3Count} H2/H3 headers | ratio=${headerRatio.toFixed(2)}/300w (AI: >1.0)` })

  // ── 4. Personal Anecdote Absence ──────────────────────────────────────────
  const personalMarkers = [
    /\bI (was|have|had|remember|once|used to|grew up|worked|tried|experienced|learned|realized)\b/gi,
    /\bmy (experience|story|journey|life|work|team|company|friend)\b/gi,
    /\bwhen I\b/gi, /\bI personally\b/gi,
  ]
  const personalCount = personalMarkers.reduce((c, rx) => c + (content.match(rx) ?? []).length, 0)
  // Real content: frequent personal references. AI: almost none
  const personalScore = personalCount === 0 ? 0.75 : personalCount < 2 ? 0.55 : personalCount < 5 ? 0.35 : 0.12
  signals.push({ name: 'Personal Anecdote Absence', score: personalScore, evidence: `${personalCount} personal references found (AI: 0, Real: >5)` })

  // ── 5. Readability Uniformity (sentence length CV) ────────────────────────
  const sentences   = content.match(/[^.!?]+[.!?]+/g) ?? []
  const sLengths    = sentences.map(s => s.trim().split(/\s+/).length).filter(n => n > 3 && n < 60)
  if (sLengths.length >= 10) {
    const sm   = sLengths.reduce((a, b) => a + b, 0) / sLengths.length
    const sstd = Math.sqrt(sLengths.reduce((a, b) => a + (b - sm) ** 2, 0) / sLengths.length)
    const scv  = sm > 0 ? sstd / sm : 1
    // AI: very uniform sentence lengths (cv < 0.30). Real: varied (cv > 0.45)
    const sentScore = scv < 0.25 ? 0.88 : scv < 0.35 ? 0.72 : scv < 0.50 ? 0.46 : 0.18
    signals.push({ name: 'Sentence Length Uniformity', score: sentScore, evidence: `CV=${scv.toFixed(3)} (AI: <0.35, Real: >0.50) across ${sLengths.length} sentences` })
  }

  // ── 6. Hedging Language Density ───────────────────────────────────────────
  const hedgePhrases = [
    'may ', 'might ', 'could ', 'would ', 'should ', 'can be',
    'it is possible', 'potentially', 'arguably', 'generally speaking',
    'in many cases', 'for the most part', 'to some extent',
    'it\'s important to', 'it is essential to',
  ]
  const hedgeCount  = hedgePhrases.reduce((c, p) => c + (contentLower.split(p).length - 1), 0)
  const hedgePerWord = wordCount > 0 ? hedgeCount / wordCount * 100 : 0
  // AI: excessive hedging (> 3 per 100 words). Real: moderate (1–2 per 100)
  const hedgeScore  = hedgePerWord > 5 ? 0.84 : hedgePerWord > 3 ? 0.68 : hedgePerWord > 2 ? 0.46 : 0.20
  signals.push({ name: 'Hedging Language Density', score: hedgeScore, evidence: `${hedgeCount} hedging phrases | ${hedgePerWord.toFixed(1)}/100 words (AI: >3/100)` })

  // ── 7. Listicle Detection ─────────────────────────────────────────────────
  const bulletCount = (content.match(/^[-*•] .+$/gm) || []).length
  const numberedList = (content.match(/^\d+\. .+$/gm) || []).length
  const listDensity = wordCount > 0 ? (bulletCount + numberedList) / (wordCount / 200) : 0
  const listScore   = listDensity > 3 ? 0.80 : listDensity > 2 ? 0.64 : listDensity > 1 ? 0.46 : 0.20
  signals.push({ name: 'Listicle Structure', score: listScore, evidence: `${bulletCount} bullets, ${numberedList} numbered items | density=${listDensity.toFixed(1)}/200w (AI: >2)` })

  // ── Ensemble ─────────────────────────────────────────────────────────────
  const weights = [0.25, 0.18, 0.14, 0.16, 0.12, 0.10, 0.05]
  const score   = Math.min(0.97, signals.reduce((s, sig, i) => s + sig.score * (weights[i] ?? 0.05), 0))
  const verdict: BlogPatternResult['verdict'] = score > 0.78 ? 'AI_BLOG' : score > 0.62 ? 'LIKELY_AI' : score < 0.35 ? 'HUMAN_WRITTEN' : 'UNCERTAIN'

  return { score, signals, ai_phrases: allFound.slice(0, 20), verdict }
}

// ── Page metadata extractor ────────────────────────────────────────────────────

interface PageMeta {
  title:        string
  domain:       string
  word_count:   number
  has_byline:   boolean
  has_date:     boolean
  image_urls:   string[]
}

function extractPageMeta(content: string, url: string): PageMeta {
  const titleMatch = content.match(/^# (.+)$/m)
  const domain     = (() => { try { return new URL(url).hostname } catch { return url } })()

  // Find image URLs in markdown-style links from Jina output
  const imageUrlRx = /https?:\/\/[^\s"'>]+\.(?:jpg|jpeg|png|webp|gif)/gi
  const imageUrls  = Array.from(new Set(content.match(imageUrlRx) ?? [])).slice(0, 10)

  // Check for byline/date patterns
  const hasByline = /by [A-Z][a-z]+ [A-Z][a-z]+|Author:|Written by|Posted by/i.test(content)
  const hasDate   = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b|\d{4}-\d{2}-\d{2}/i.test(content)

  return {
    title:      titleMatch?.[1] ?? domain,
    domain,
    word_count: content.split(/\s+/).length,
    has_byline: hasByline,
    has_date:   hasDate,
    image_urls: imageUrls,
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl  = await checkRateLimit('text', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  let userId: string
  try {
    const guard = await creditGuard(req, 'text')
    userId      = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Auth failed' } }, { status: 500 })
  }

  let body: { url?: unknown; includeImages?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 }) }

  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) return NextResponse.json({ success: false, error: { code: 'NO_URL', message: '"url" field required' } }, { status: 400 })

  let parsedUrl: URL
  try { parsedUrl = new URL(url) } catch { return NextResponse.json({ success: false, error: { code: 'INVALID_URL', message: 'Invalid URL' } }, { status: 400 }) }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return NextResponse.json({ success: false, error: { code: 'INVALID_PROTOCOL', message: 'Only http/https URLs allowed' } }, { status: 400 })

  const start = Date.now()

  try {
    // Step 1: Fetch full page content
    const content = await fetchPageContent(url, 12000)
    if (!content || content.length < 80) return NextResponse.json({ success: false, error: { code: 'FETCH_FAILED', message: 'Could not fetch readable content from URL' } }, { status: 422 })

    // Step 2: Extract page metadata
    const pageMeta = extractPageMeta(content, url)

    // Step 3: Blog pattern analysis
    const blogPatterns = analyzeBlogPatterns(content)

    // Step 4: Full text detection pipeline (ML ensemble)
    const textResult = await analyzeText(content.slice(0, 50000))

    // Step 5: Text Brain direct analysis for raw brain signals
    const brainResult = analyzeTextWithBrain(content.slice(0, 50000))

    // Step 6: Image analysis — extract image URLs from page and run 9-agent forensic RAG
    // includeImages must be explicitly true; max 5 images per scan (cost control)
    const includeImages = body?.includeImages === true
    const pageImageUrls  = extractImageUrls(content, url)
    let imageAnalysisResults: PageImageResult[] = []
    if (includeImages && pageImageUrls.length > 0) {
      try {
        imageAnalysisResults = await analyzePageImages(pageImageUrls)
      } catch (imgErr) {
        console.warn('[detect/web] Image analysis failed (non-fatal):', imgErr)
      }
    }

    // Step 7: Final blended verdict
    // Weights: textResult(50%) + blogPatterns(30%) + brainResult(20%)
    const blendedConf = Math.min(0.99, Math.max(0.01,
      textResult.confidence * 0.50 +
      blogPatterns.score    * 0.30 +
      brainResult.score     * 0.20
    ))
    const verdict: 'AI' | 'HUMAN' | 'UNCERTAIN' =
      blendedConf > 0.65 ? 'AI' : blendedConf < 0.35 ? 'HUMAN' : 'UNCERTAIN'

    const processingTime = Date.now() - start

    // Save scan record
    let scanId: string | null = null
    if (userId && !userId.startsWith('anon_')) {
      try {
        const { data: sr } = await getSupabaseAdmin().from('scans').insert({
          user_id:          userId,
          media_type:       'text',
          file_name:        pageMeta.title.slice(0, 120),
          verdict,
          confidence_score: blendedConf,
          signals:          textResult.signals,
          processing_time:  processingTime,
          model_used:       `WebScanner-v1+${textResult.model_used}`,
          status:           'complete',
          metadata:         {
            url,
            domain:          pageMeta.domain,
            word_count:      pageMeta.word_count,
            blog_pattern_score: blogPatterns.score,
            blog_verdict:    blogPatterns.verdict,
          },
        }).select('id').single()
        scanId = sr?.id ?? null
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success:     true,
      scan_id:     scanId,
      url,
      verdict,
      confidence:  Math.round(blendedConf * 1000) / 1000,
      model_used:  `WebScanner-v1+${textResult.model_used}`,
      model_version: '1.0.0',
      processing_time: processingTime,

      // Text pipeline signals
      signals: textResult.signals,
      summary: verdict === 'AI'
        ? `AI-generated content detected at ${Math.round(blendedConf * 100)}% confidence. Blog pattern score: ${Math.round(blogPatterns.score * 100)}%. ${blogPatterns.ai_phrases.length} AI phrases found.`
        : verdict === 'HUMAN'
        ? `Content appears human-written (${Math.round((1 - blendedConf) * 100)}% confidence). Natural variation detected.`
        : `Analysis inconclusive (${Math.round(blendedConf * 100)}% AI probability). Mixed signals detected.`,

      // Blog-specific analysis
      blog_pattern: {
        score:     Math.round(blogPatterns.score * 1000) / 1000,
        verdict:   blogPatterns.verdict,
        signals:   blogPatterns.signals,
        ai_phrases_found: blogPatterns.ai_phrases,
      },

      // Page metadata
      page_meta: pageMeta,

      // Brain signals
      brain: {
        score:    Math.round(brainResult.score * 1000) / 1000,
        verdict:  brainResult.verdict,
        findings: brainResult.findings?.slice(0, 6) ?? [],
      },

      // Image analysis (only populated when includeImages: true)
      images:      imageAnalysisResults,
      imageCount:  pageImageUrls.length,
    })
  } catch (err) {
    console.error('[detect/web]', err)
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } },
      { status: 500 }
    )
  }
}

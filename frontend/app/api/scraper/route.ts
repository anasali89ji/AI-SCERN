export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { fetchWithProxy }             from '@/lib/proxy/fetch-with-proxy'
import { geminiAvailable }            from '@/lib/inference/gemini-analyzer'
import { GoogleGenerativeAI }         from '@google/generative-ai'
import { assertSafeUrl }              from '@/lib/utils/ssrf-guard'
import * as cheerio                   from 'cheerio'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────
interface PageData {
  url:         string
  title:       string
  description: string
  textContent: string
  wordCount:   number
  contentType: 'article' | 'product' | 'homepage' | 'forum' | 'documentation' | 'other'
  links:       { url: string; text: string; isInternal: boolean }[]
  imageUrls:   string[]
  publishDate?: string
  author?:     string
  language?:   string
  headings:    string[]
  metaKeywords?: string
}

interface DetectionSignal {
  name:        string
  flagged:     boolean
  description: string
  weight:      number
}

interface ContentAnalysis {
  aiScore:       number
  verdict:       'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence:    number
  contentQuality:'high' | 'medium' | 'low'
  signals:       DetectionSignal[]
  summary:       string
  reasoning:     string
  writingStyle:  string
}

interface SubPageResult {
  url:         string
  title:       string
  contentType: string
  wordCount:   number
  aiScore:     number
  verdict:     string
  snippet:     string
}

// ── Cheerio HTML Parser ────────────────────────────────────────────────────────
function parseHTML(html: string, baseUrl: string): PageData {
  const url = new URL(baseUrl)
  const $   = cheerio.load(html)

  // Remove noise
  $('script, style, nav, footer, header, aside, .ads, .advertisement, #cookie-banner, .popup').remove()

  const title       = $('title').text().trim() || $('h1').first().text().trim() || url.hostname
  const description = $('meta[name="description"]').attr('content')?.trim() ||
                      $('meta[property="og:description"]').attr('content')?.trim() || ''
  const author      = $('meta[name="author"]').attr('content')?.trim() ||
                      $('[rel="author"]').first().text().trim() ||
                      $('.author, .byline, [class*="author"]').first().text().trim() || undefined
  const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                      $('time[datetime]').first().attr('datetime') || undefined
  const language    = $('html').attr('lang')?.slice(0, 2) || undefined
  const metaKeywords= $('meta[name="keywords"]').attr('content')?.trim() || undefined

  // Extract headings for structure analysis
  const headings: string[] = []
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().trim()
    if (t.length > 3 && headings.length < 15) headings.push(t)
  })

  // Extract main text blocks — priority order: article > main > body paragraphs
  const textBlocks: string[] = []
  const mainSelectors = ['article', 'main', '[role="main"]', '.post-content', '.article-content', '.entry-content', '.content', '#content']
  let $main = $()
  for (const sel of mainSelectors) {
    if ($(sel).length) { $main = $(sel).first(); break }
  }
  const $container = $main.length ? $main : $('body')

  $container.find('p, h1, h2, h3, h4, blockquote, li').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 40 && textBlocks.length < 80) textBlocks.push(text.slice(0, 1000))
  })

  const textContent = textBlocks.join('\n\n')
  const wordCount   = textContent.split(/\s+/).filter(Boolean).length

  // Content type detection
  const fullText = html.toLowerCase()
  const isArticle = /article|blog|post|news|story/i.test(fullText) || /\/(blog|news|article|post)\//i.test(url.pathname)
  const isProduct = /product|shop|buy|price|cart|add.to.bag/i.test(fullText)
  const isForum   = /forum|community|discuss|comment|reply|thread/i.test(url.hostname + url.pathname)
  const isDocs    = /docs|documentation|api|reference|guide/i.test(url.pathname)
  const contentType = isArticle ? 'article' : isProduct ? 'product' : isForum ? 'forum' : isDocs ? 'documentation' : url.pathname === '/' ? 'homepage' : 'other'

  // Extract links
  const links: PageData['links'] = []
  $('a[href]').each((_, el) => {
    if (links.length >= 40) return
    try {
      let href = $(el).attr('href')?.trim() || ''
      if (href.startsWith('//')) href = `https:${href}`
      else if (href.startsWith('/')) href = `${url.origin}${href}`
      const linkUrl  = new URL(href)
      const linkText = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 100)
      if (linkUrl.protocol.startsWith('http') && linkText.length > 2) {
        links.push({ url: linkUrl.href, text: linkText, isInternal: linkUrl.hostname === url.hostname })
      }
    } catch {}
  })

  // Extract images
  const imageUrls: string[] = []
  $('img[src]').each((_, el) => {
    if (imageUrls.length >= 12) return
    try {
      let src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (src.startsWith('//')) src = `https:${src}`
      else if (src.startsWith('/')) src = `${url.origin}${src}`
      if (src.startsWith('http') && !src.includes('tracking') && !src.includes('pixel') && !src.includes('1x1')) {
        imageUrls.push(src)
      }
    } catch {}
  })

  return { url: baseUrl, title, description, textContent, wordCount, contentType, links, imageUrls, publishDate, author, language, headings, metaKeywords }
}

// ── Screenshot via thum.io (free, no API key) ─────────────────────────────────
function getScreenshotUrl(targetUrl: string): string {
  // thum.io: free screenshot service, no key required
  return `https://image.thum.io/get/width/1280/crop/800/noanimate/${encodeURIComponent(targetUrl)}`
}

// ── Content quality scorer ─────────────────────────────────────────────────────
function scoreContentQuality(text: string, wordCount: number, headings: string[]): 'high' | 'medium' | 'low' {
  if (wordCount < 80) return 'low'
  const hasStructure = headings.length >= 2
  const hasDepth     = wordCount > 400
  const noLorem      = !text.includes('Lorem ipsum')
  if (hasStructure && hasDepth && noLorem) return 'high'
  if (wordCount > 150 && noLorem) return 'medium'
  return 'low'
}

// ── Gemini RAG Analysis — 12 structured signals ───────────────────────────────
async function analyzeWithGemini(
  page:         PageData,
  subPageTexts: string[],
  model = 'gemini-2.0-flash',
): Promise<ContentAnalysis> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const mdl   = genAI.getGenerativeModel({ model })

  const headingBlock = page.headings.length
    ? `HEADINGS: ${page.headings.slice(0, 8).join(' | ')}`
    : ''

  const subContext = subPageTexts.slice(0, 3)
    .map((t, i) => `SUB-PAGE ${i + 1}:\n${t.slice(0, 800)}`)
    .join('\n\n---\n\n')

  const combinedContext = [
    `MAIN PAGE (${page.contentType}, ${page.wordCount} words):`,
    headingBlock,
    page.textContent.slice(0, 3500),
    subContext ? '\n\n=== SUB-PAGES ===\n' + subContext : '',
  ].filter(Boolean).join('\n')

  const prompt = `You are Aiscern's production AI content detection engine analyzing a live website.

WEBSITE METADATA:
- Title: "${page.title}"
- Domain: ${new URL(page.url).hostname}
- Content type: ${page.contentType}
- Word count: ${page.wordCount}
- Language: ${page.language || 'en'}
- Author detected: ${page.author || 'none'}
- Published: ${page.publishDate || 'unknown'}

CONTENT TO ANALYZE:
${combinedContext}

Analyze all signals and respond ONLY in this exact JSON format (no markdown, no preamble):
{
  "ai_probability": 0.0,
  "verdict": "AI",
  "content_quality": "high",
  "writing_style": "one sentence describing the writing style",
  "summary": "2-3 sentence analysis for the user",
  "reasoning": "key evidence supporting verdict",
  "signals": [
    {"name": "Signal Name", "flagged": true, "description": "brief explanation", "weight": 0.8}
  ]
}

Evaluate ALL 12 signals:
1. Transition overuse — "Furthermore", "Moreover", "Additionally", "In conclusion", "It is important to note"
2. Sentence uniformity — suspiciously consistent length and rhythm across all paragraphs
3. Personal voice absence — no first-person anecdotes, lived experience, or idiosyncratic opinions
4. Hedging language — generic qualifiers without specific claims or data
5. Structural perfection — every section perfectly parallel, numbered lists too neat
6. Keyword stuffing — obvious SEO over-optimization patterns
7. Factual vagueness — broad claims without specific names, dates, or numbers
8. Tonal flatness — no humor, sarcasm, frustration, or genuine emotional variance
9. Cross-page consistency — all sub-pages share identical style, cadence, and structure
10. Authorship signals — missing byline, bio, or any personal attribution
11. Natural imperfections — absence of typos, colloquialisms, contractions, broken sentences
12. Human specificity — lack of specific references to time, place, culture, or personal network

For each signal: flagged=true means it indicates AI generation. weight is 0.0-1.0 importance.`

  const result = await mdl.generateContent(prompt)
  const raw    = result.response.text()

  try {
    const clean  = raw.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(clean)
    const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
    return {
      aiScore,
      verdict:       aiScore >= 0.60 ? 'AI' : aiScore <= 0.38 ? 'HUMAN' : 'UNCERTAIN',
      confidence:    Math.round(Math.abs(aiScore - 0.5) * 200),
      contentQuality:parsed.content_quality ?? 'medium',
      signals:       Array.isArray(parsed.signals) ? parsed.signals.slice(0, 12) : [],
      summary:       parsed.summary ?? `Analysis complete. AI probability: ${Math.round(aiScore * 100)}%`,
      reasoning:     parsed.reasoning ?? '',
      writingStyle:  parsed.writing_style ?? '',
    }
  } catch {
    return {
      aiScore: 0.5, verdict: 'UNCERTAIN', confidence: 0,
      contentQuality: 'medium', signals: [],
      summary: 'Analysis could not be parsed — please retry.',
      reasoning: '', writingStyle: '',
    }
  }
}

// ── HuggingFace Fallback ──────────────────────────────────────────────────────
async function analyzeTextHF(text: string): Promise<{ aiScore: number; verdict: string }> {
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
  if (!token) return { aiScore: 0.5, verdict: 'UNCERTAIN' }
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/openai-community/roberta-base-openai-detector',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: text.slice(0, 512) }),
        signal: AbortSignal.timeout(12_000),
      }
    )
    if (!res.ok) return { aiScore: 0.5, verdict: 'UNCERTAIN' }
    const data = await res.json() as { label: string; score: number }[][]
    const flat = Array.isArray(data[0]) ? data[0] : (data as unknown as { label: string; score: number }[])
    const aiE  = flat.find(s => /fake|label_1/i.test(s.label))
    const huE  = flat.find(s => /real|label_0/i.test(s.label))
    const score = aiE?.score ?? (huE ? 1 - huE.score : 0.5)
    return { aiScore: score, verdict: score >= 0.60 ? 'AI' : score <= 0.38 ? 'HUMAN' : 'UNCERTAIN' }
  } catch {
    return { aiScore: 0.5, verdict: 'UNCERTAIN' }
  }
}


// ── NVIDIA NIM Fallback (Kimi K2 / meta-llama) ───────────────────────────────
async function analyzeWithNVIDIA(
  page:         PageData,
  subPageTexts: string[],
): Promise<ContentAnalysis | null> {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY
  if (!apiKey) return null

  const combinedText = [
    page.textContent.slice(0, 2000),
    ...subPageTexts.slice(0, 2).map(t => t.slice(0, 400)),
  ].join('\n\n---\n\n')

  const prompt = `Analyze this website content for AI generation. Respond ONLY in JSON:
{"ai_probability":0.0,"verdict":"AI","summary":"2 sentence analysis","signals":[{"name":"Signal","flagged":true,"description":"evidence","weight":0.8}]}

Evaluate: transition overuse, sentence uniformity, personal voice, hedging, structural perfection, keyword stuffing, factual vagueness, tonal flatness.

Content: ${combinedText}`

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { choices: { message: { content: string } }[] }
    const raw = data.choices?.[0]?.message?.content ?? ''
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(clean)
    const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
    return {
      aiScore,
      verdict:       aiScore >= 0.60 ? 'AI' : aiScore <= 0.38 ? 'HUMAN' : 'UNCERTAIN',
      confidence:    Math.round(Math.abs(aiScore - 0.5) * 200),
      contentQuality: scoreContentQuality(page.textContent, page.wordCount, page.headings),
      signals:       Array.isArray(parsed.signals) ? parsed.signals.slice(0, 8) : [],
      summary:       parsed.summary ?? `NVIDIA analysis: ${Math.round(aiScore * 100)}% AI probability.`,
      reasoning:     '',
      writingStyle:  '',
    }
  } catch {
    return null
  }
}

// ── Sub-page Crawler ──────────────────────────────────────────────────────────
// Parallel sub-page crawler — all pages fetched simultaneously
async function crawlSubPages(links: PageData['links'], maxPages = 5): Promise<SubPageResult[]> {
  const toVisit = links.filter(l => l.isInternal).slice(0, maxPages)

  const settled = await Promise.allSettled(
    toVisit.map(async (link): Promise<SubPageResult | null> => {
      try {
        assertSafeUrl(link.url)
        // Parallel fetch + parse + analyze all at once
        const [res] = await Promise.all([
          fetchWithProxy(link.url, { maxRetries: 0, timeoutMs: 7000 }),
        ])
        if (!res.ok) return null
        const html = await res.text()
        const page = parseHTML(html, link.url)
        if (page.wordCount < 60) return null
        const analysis = await analyzeTextHF(page.textContent.slice(0, 600))
        return {
          url:         link.url,
          title:       page.title,
          contentType: page.contentType,
          wordCount:   page.wordCount,
          aiScore:     analysis.aiScore,
          verdict:     analysis.verdict,
          snippet:     page.textContent.slice(0, 240) + (page.textContent.length > 240 ? '…' : ''),
        }
      } catch { return null }
    })
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<SubPageResult> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to use the web scanner' } },
      { status: 401 }
    )
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('scraper', ip)
  if ((rl as unknown as { limited: boolean }).limited) {
    return NextResponse.json(rateLimitResponse(), { status: 429 })
  }

  try {
    const body                    = await req.json()
    const { url, depth = 1, maxSubPages = 5 } = body

    if (!url) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_URL', message: 'URL is required' } },
        { status: 400 }
      )
    }

    // SSRF guard — block private IPs, metadata endpoints, dangerous ports
    try { assertSafeUrl(url) } catch (e: any) {
      return NextResponse.json(
        { success: false, error: { code: 'BLOCKED_URL', message: e.message } },
        { status: 400 }
      )
    }

    let urlObj: URL
    try { urlObj = new URL(url) } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_URL', message: 'Invalid URL format' } },
        { status: 400 }
      )
    }

    // Fetch main page + screenshot in parallel
    const [mainRes] = await Promise.all([
      fetchWithProxy(url, { maxRetries: 2, timeoutMs: 15000 }),
    ])

    if (!mainRes.ok) throw new Error(`Failed to fetch page: ${mainRes.status}`)
    const mainHtml = await mainRes.text()
    const mainPage = parseHTML(mainHtml, url)

    if (mainPage.wordCount < 30) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: 'Not enough readable text on this page to analyze. Try a blog post or article URL.' } },
        { status: 422 }
      )
    }

    // Crawl sub-pages if depth > 0
    const subPageResults = depth > 0
      ? await crawlSubPages(mainPage.links, maxSubPages)
      : []

    // Analyze with Gemini RAG — with automatic HuggingFace fallback on quota/rate errors
    const useGemini = geminiAvailable()
    let analysis: ContentAnalysis
    let engineUsed = useGemini ? 'Gemini 2.0 Flash + Cheerio RAG' : 'HuggingFace RoBERTa'

    const buildHFAnalysis = async (): Promise<ContentAnalysis> => {
      const hf = await analyzeTextHF(mainPage.textContent.slice(0, 1200))
      engineUsed = 'HuggingFace RoBERTa (Gemini quota exceeded)'
      return {
        aiScore:        hf.aiScore,
        verdict:        hf.verdict as 'AI' | 'HUMAN' | 'UNCERTAIN',
        confidence:     Math.round(Math.abs(hf.aiScore - 0.5) * 200),
        contentQuality: scoreContentQuality(mainPage.textContent, mainPage.wordCount, mainPage.headings),
        signals: [
          { name: 'RoBERTa Detector', flagged: hf.verdict === 'AI', description: 'openai-community/roberta-base-openai-detector', weight: 1.0 },
        ],
        summary:      `AI probability: ${Math.round(hf.aiScore * 100)}%. ${hf.verdict === 'AI' ? 'Content shows strong AI-generation signals.' : hf.verdict === 'HUMAN' ? 'Content appears to be human-written.' : 'Content origin is uncertain.'}`,
        reasoning:    '',
        writingStyle: '',
      }
    }

    if (useGemini) {
      try {
        analysis = await analyzeWithGemini(mainPage, subPageResults.map(s => s.snippet), 'gemini-2.0-flash')
      } catch (geminiErr: any) {
        const isQuota = /429|quota|rate.?limit|too many/i.test(geminiErr?.message ?? '')
        if (isQuota) {
          // Tier 2: gemini-1.5-flash (separate quota)
          try {
            console.warn('[scraper] gemini-2.0-flash quota — trying gemini-1.5-flash')
            analysis = await analyzeWithGemini(mainPage, subPageResults.map(s => s.snippet), 'gemini-1.5-flash')
            engineUsed = 'Gemini 1.5 Flash + Cheerio RAG'
          } catch {
            // Tier 3: NVIDIA NIM (Kimi K2 / Llama)
            const nvResult = await analyzeWithNVIDIA(mainPage, subPageResults.map(s => s.snippet))
            if (nvResult) {
              analysis = nvResult
              engineUsed = `NVIDIA ${process.env.NVIDIA_MODEL || 'Llama-3.1-8B'}`
            } else {
              // Tier 4: HuggingFace RoBERTa
              console.warn('[scraper] All AI engines exhausted — falling back to HuggingFace')
              analysis = await buildHFAnalysis()
            }
          }
        } else {
          throw geminiErr
        }
      }
    } else {
      analysis = await buildHFAnalysis()
    }

    // Screenshot URL (thum.io — free, no key, generates on-demand)
    const screenshotUrl = getScreenshotUrl(url)

    return NextResponse.json({
      success: true,
      data: {
        url,
        domain:           urlObj.hostname,
        title:            mainPage.title,
        description:      mainPage.description || `Content from ${urlObj.hostname}`,
        author:           mainPage.author,
        language:         mainPage.language,
        publish_date:     mainPage.publishDate,
        content_type:     mainPage.contentType,
        word_count:       mainPage.wordCount,
        content_quality:  analysis.contentQuality,
        overall_ai_score: Math.round(analysis.aiScore * 100),
        verdict:          analysis.verdict,
        confidence:       analysis.confidence,
        summary:          analysis.summary,
        reasoning:        analysis.reasoning,
        writing_style:    analysis.writingStyle,
        signals:          analysis.signals,
        screenshot_url:   screenshotUrl,
        image_urls:       mainPage.imageUrls.slice(0, 8),
        headings:         mainPage.headings.slice(0, 6),
        sub_pages:        subPageResults.map(sp => ({
          url:          sp.url,
          title:        sp.title,
          content_type: sp.contentType,
          word_count:   sp.wordCount,
          ai_score:     Math.round(sp.aiScore * 100),
          verdict:      sp.verdict,
          snippet:      sp.snippet,
        })),
        discovered_links: mainPage.links.slice(0, 20).map(l => ({
          url:         l.url,
          text:        l.text,
          is_internal: l.isInternal,
        })),
        total_links:  mainPage.links.length,
        status:       'complete',
        engine_used:  engineUsed,
      },
    })
  } catch (err: unknown) {
    const msg       = (err as Error)?.message || 'Scan failed'
    const isBlocked = /403|blocked|CORS|ERR_|ECONNREFUSED/.test(msg)
    return NextResponse.json({
      success: false,
      error: {
        code:    isBlocked ? 'BLOCKED' : 'SCRAPE_FAILED',
        message: isBlocked
          ? 'This website blocks automated scanning. Try a specific article or blog post URL instead.'
          : `Scan failed: ${msg}`,
      },
    }, { status: 500 })
  }
}

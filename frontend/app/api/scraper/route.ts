export const maxDuration = 60

import { NextRequest, NextResponse }    from 'next/server'
import { auth }                          from '@clerk/nextjs/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { fetchWithProxy }                from '@/lib/proxy/fetch-with-proxy'
import { geminiAvailable }               from '@/lib/inference/gemini-analyzer'
import { GoogleGenerativeAI }            from '@google/generative-ai'
import { assertSafeUrl }                 from '@/lib/utils/ssrf-guard'
import { getSupabaseAdmin }              from '@/lib/supabase/admin'
import * as cheerio                      from 'cheerio'

export const dynamic = 'force-dynamic'

interface PageData {
  url:          string
  title:        string
  description:  string
  textContent:  string
  wordCount:    number
  contentType:  'article' | 'product' | 'homepage' | 'forum' | 'documentation' | 'other'
  links:        { url: string; text: string; isInternal: boolean }[]
  imageUrls:    string[]
  publishDate?: string
  author?:      string
  language?:    string
  headings:     string[]
  metaKeywords?:string
  fetchMethod:  'direct' | 'jina' | 'cache'
}
interface DetectionSignal { name: string; flagged: boolean; description: string; weight: number }
interface ContentAnalysis {
  aiScore: number; verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'; confidence: number
  contentQuality: 'high' | 'medium' | 'low'; signals: DetectionSignal[]
  summary: string; reasoning: string; writingStyle: string
}
interface SubPageResult {
  url: string; title: string; contentType: string; wordCount: number
  aiScore: number; verdict: string; snippet: string
}

const STEALTH_HEADERS: Record<string, string> = {
  'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language':           'en-US,en;q=0.9',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            'none',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control':             'max-age=0',
  'DNT':                       '1',
}

// ── Multi-strategy fetcher: Direct → Jina.ai → Google Cache ──────────────────
async function fetchPage(url: string): Promise<{ html: string; fetchMethod: PageData['fetchMethod'] }> {
  // Strategy 1: Direct + proxy rotation
  try {
    const res = await fetchWithProxy(url, { timeoutMs: 12000, maxRetries: 2, headers: STEALTH_HEADERS })
    if (res.ok) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('text/html') || ct.includes('text/plain')) {
        const html = await res.text()
        if (html.length > 500) return { html, fetchMethod: 'direct' }
      }
    }
  } catch { /* fall through */ }

  // Strategy 2: Jina.ai reader — JS rendering, bypasses paywalls & SPAs
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/html', 'X-Return-Format': 'html', 'X-Timeout': '20', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(22_000),
    })
    if (res.ok) {
      const text = await res.text()
      if (text.length > 300) {
        const wrapped = text.startsWith('<!') ? text : `<html><body>${text}</body></html>`
        return { html: wrapped, fetchMethod: 'jina' }
      }
    }
  } catch { /* fall through */ }

  // Strategy 3: Google webcache
  try {
    const res = await fetch(
      `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}&hl=en`,
      { headers: { 'User-Agent': STEALTH_HEADERS['User-Agent'] }, signal: AbortSignal.timeout(10_000) }
    )
    if (res.ok) {
      const html = await res.text()
      if (html.length > 500) return { html, fetchMethod: 'cache' }
    }
  } catch { /* fall through */ }

  throw new Error('All fetch strategies failed — site may be blocking automated access')
}

// ── HTML Parser ───────────────────────────────────────────────────────────────
function parseHTML(html: string, baseUrl: string, fetchMethod: PageData['fetchMethod']): PageData {
  const url = new URL(baseUrl)
  const $   = cheerio.load(html)

  $(['script','style','nav','footer','header','aside',
    '.ads','.advertisement','.ad-container','#cookie-banner','.cookie',
    '.gdpr','.popup','.modal','.newsletter','.sidebar','.related-posts',
    '[class*="cookie"]','[id*="cookie"]','[class*="popup"]',
    '[class*="overlay"]','[class*="modal"]','noscript',
  ].join(', ')).remove()

  const title       = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim() || $('h1').first().text().trim() || url.hostname
  const description = $('meta[property="og:description"]').attr('content')?.trim() || $('meta[name="description"]').attr('content')?.trim() || ''
  const author      = $('meta[name="author"]').attr('content')?.trim() ||
                      $('[rel="author"]').first().text().trim() ||
                      $('.author,.byline,[itemprop="author"]').first().text().trim() ||
                      $('meta[property="article:author"]').attr('content')?.trim() || undefined
  const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                      $('meta[property="og:updated_time"]').attr('content') ||
                      $('time[datetime]').first().attr('datetime') || undefined
  const language    = $('html').attr('lang')?.slice(0, 5) || undefined
  const metaKeywords= $('meta[name="keywords"]').attr('content')?.trim() || undefined

  const headings: string[] = []
  $('h1,h2,h3').each((_, el) => { const t = $(el).text().trim(); if (t.length > 3 && headings.length < 15) headings.push(t) })

  const mainSelectors = [
    'article','main','[role="main"]',
    '.post-content','.article-content','.entry-content',
    '.post-body','.article-body','.story-body',
    '.blog-content','.page-content',
    '[class*="article"]','[class*="post-body"]',
    '#content','.content','#main',
  ]
  let $main = $()
  for (const sel of mainSelectors) { if ($(sel).length) { $main = $(sel).first(); break } }
  const $container = $main.length ? $main : $('body')

  const textBlocks: string[] = []
  $container.find('p,h1,h2,h3,h4,blockquote,li,td').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 35 && textBlocks.length < 100) textBlocks.push(text.slice(0, 1200))
  })
  const textContent = textBlocks.join('\n\n')
  const wordCount   = textContent.split(/\s+/).filter(Boolean).length

  const fullText    = (html + url.href).toLowerCase()
  const isArticle   = /article|blog|post|news|story|editorial/i.test(fullText) || /\/(blog|news|article|post|story)\//i.test(url.pathname)
  const isProduct   = /product|shop|buy|price|cart|checkout/i.test(fullText)
  const isForum     = /forum|community|discuss|reply|thread|reddit|quora/i.test(url.hostname + url.pathname)
  const isDocs      = /docs|documentation|api.?ref|reference|guide|manual/i.test(url.pathname)
  const contentType = isArticle ? 'article' : isProduct ? 'product' : isForum ? 'forum' :
                      isDocs ? 'documentation' : url.pathname === '/' ? 'homepage' : 'other'

  const links: PageData['links'] = []
  $('a[href]').each((_, el) => {
    if (links.length >= 50) return
    try {
      let href = $(el).attr('href')?.trim() || ''
      if (href.startsWith('//')) href = `https:${href}`
      else if (href.startsWith('/')) href = `${url.origin}${href}`
      const linkUrl  = new URL(href)
      const linkText = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120)
      if (linkUrl.protocol.startsWith('http') && linkText.length > 2 && !href.includes('#'))
        links.push({ url: linkUrl.href, text: linkText, isInternal: linkUrl.hostname === url.hostname })
    } catch {}
  })

  const imageUrls: string[] = []
  $('img[src],img[data-src],img[data-lazy-src]').each((_, el) => {
    if (imageUrls.length >= 12) return
    try {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
      if (src.startsWith('//')) src = `https:${src}`
      else if (src.startsWith('/')) src = `${url.origin}${src}`
      if (src.startsWith('http') && !src.includes('tracking') && !src.includes('pixel') && !src.includes('1x1') && !src.includes('blank') && src.length < 500)
        imageUrls.push(src)
    } catch {}
  })

  return { url: baseUrl, title, description, textContent, wordCount, contentType, links, imageUrls, publishDate, author, language, headings, metaKeywords, fetchMethod }
}

// ── Screenshot — WordPress mshots (free, no key, high reliability) ─────────
function getScreenshotUrl(targetUrl: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(targetUrl)}?w=1200&h=750`
}

function scoreContentQuality(text: string, wordCount: number, headings: string[]): 'high' | 'medium' | 'low' {
  if (wordCount < 80) return 'low'
  if (headings.length >= 2 && wordCount > 400 && !text.includes('Lorem ipsum')) return 'high'
  if (wordCount > 150 && !text.includes('Lorem ipsum')) return 'medium'
  return 'low'
}

// ── Gemini RAG — 12-signal analysis ──────────────────────────────────────────
async function analyzeWithGemini(page: PageData, subPageTexts: string[], model = 'gemini-2.0-flash'): Promise<ContentAnalysis> {
  const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const mdl    = genAI.getGenerativeModel({ model })
  const subCtx = subPageTexts.slice(0, 3).map((t, i) => `SUB-PAGE ${i + 1}:\n${t.slice(0, 900)}`).join('\n\n---\n\n')
  const ctx    = [
    `MAIN PAGE (${page.contentType}, ${page.wordCount} words, via ${page.fetchMethod}):`,
    page.headings.length ? `HEADINGS: ${page.headings.slice(0, 10).join(' | ')}` : '',
    page.textContent.slice(0, 4000),
    subCtx ? '\n\n=== SUB-PAGES ===\n' + subCtx : '',
  ].filter(Boolean).join('\n')

  const prompt = `You are Aiscern's AI content detection engine. Analyze this website.

METADATA:
- Title: "${page.title}"
- Domain: ${new URL(page.url).hostname}
- Type: ${page.contentType} | Words: ${page.wordCount} | Lang: ${page.language || 'en'}
- Author: ${page.author || 'not detected'} | Published: ${page.publishDate || 'unknown'}
- Keywords: ${page.metaKeywords?.slice(0, 80) || 'none'}

CONTENT:
${ctx}

Respond ONLY in this exact JSON (no markdown):
{"ai_probability":0.0,"verdict":"AI","content_quality":"high","writing_style":"one sentence","summary":"2-3 sentence verdict explanation","reasoning":"key linguistic evidence","signals":[{"name":"Signal","flagged":true,"description":"brief","weight":0.8}]}

Score ALL 12 signals:
1. Transition overuse — Furthermore/Moreover/Additionally/In conclusion
2. Sentence uniformity — identical rhythm and length throughout
3. Personal voice absence — no first-person anecdotes or lived experience
4. Hedging language — vague qualifiers without concrete data
5. Structural perfection — unnaturally parallel sections and neat lists
6. Keyword stuffing — obvious SEO patterns
7. Factual vagueness — no specific names, dates, or verifiable numbers
8. Tonal flatness — no humor, sarcasm, frustration, genuine emotion
9. Cross-page consistency — sub-pages identical in style and cadence
10. Authorship signals — missing byline, bio, or personal attribution
11. Natural imperfections — absence of typos, contractions, casual structures
12. Human specificity — no cultural refs, personal network, time/place context`

  const result = await mdl.generateContent(prompt)
  const raw    = result.response.text()
  try {
    const m    = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : raw.replace(/```json\n?|\n?```/g, '').trim())
    const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
    return {
      aiScore,
      verdict:        aiScore >= 0.60 ? 'AI' : aiScore <= 0.38 ? 'HUMAN' : 'UNCERTAIN',
      confidence:     Math.round(Math.abs(aiScore - 0.5) * 200),
      contentQuality: parsed.content_quality ?? scoreContentQuality(page.textContent, page.wordCount, page.headings),
      signals:        Array.isArray(parsed.signals) ? parsed.signals.slice(0, 12) : [],
      summary:        parsed.summary ?? `AI probability: ${Math.round(aiScore * 100)}%.`,
      reasoning:      parsed.reasoning ?? '',
      writingStyle:   parsed.writing_style ?? '',
    }
  } catch {
    const m2 = raw.match(/"ai_probability"\s*:\s*([\d.]+)/)
    const aiScore = m2 ? Math.max(0, Math.min(1, parseFloat(m2[1]))) : 0.5
    return { aiScore, verdict: 'UNCERTAIN', confidence: 0, contentQuality: 'medium', signals: [], summary: 'Analysis parsed partially. Please retry for full results.', reasoning: '', writingStyle: '' }
  }
}

// ── HuggingFace fallback ──────────────────────────────────────────────────────
async function analyzeTextHF(text: string): Promise<{ aiScore: number; verdict: string }> {
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
  if (!token) return { aiScore: 0.5, verdict: 'UNCERTAIN' }
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/openai-community/roberta-base-openai-detector', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text.slice(0, 512) }), signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return { aiScore: 0.5, verdict: 'UNCERTAIN' }
    const data = await res.json() as { label: string; score: number }[][]
    const flat = Array.isArray(data[0]) ? data[0] : (data as unknown as { label: string; score: number }[])
    const aiE  = flat.find(s => /fake|label_1/i.test(s.label))
    const huE  = flat.find(s => /real|label_0/i.test(s.label))
    const score = aiE?.score ?? (huE ? 1 - huE.score : 0.5)
    return { aiScore: score, verdict: score >= 0.60 ? 'AI' : score <= 0.38 ? 'HUMAN' : 'UNCERTAIN' }
  } catch { return { aiScore: 0.5, verdict: 'UNCERTAIN' } }
}

// ── NVIDIA NIM fallback ───────────────────────────────────────────────────────
async function analyzeWithNVIDIA(page: PageData, subPageTexts: string[]): Promise<ContentAnalysis | null> {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY
  if (!apiKey) return null
  const combinedText = [page.textContent.slice(0, 2000), ...subPageTexts.slice(0, 2).map(t => t.slice(0, 400))].join('\n\n---\n\n')
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: `Analyze for AI generation. JSON only:\n{"ai_probability":0.0,"verdict":"AI","summary":"analysis","signals":[{"name":"s","flagged":true,"description":"d","weight":0.8}]}\n\nContent: ${combinedText.slice(0, 1800)}` }],
        temperature: 0.1, max_tokens: 400,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const data  = await res.json() as { choices: { message: { content: string } }[] }
    const raw   = data.choices?.[0]?.message?.content ?? ''
    const m     = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : raw.replace(/```json\n?|\n?```/g, '').trim())
    const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
    return {
      aiScore, verdict: aiScore >= 0.60 ? 'AI' : aiScore <= 0.38 ? 'HUMAN' : 'UNCERTAIN',
      confidence: Math.round(Math.abs(aiScore - 0.5) * 200),
      contentQuality: scoreContentQuality(page.textContent, page.wordCount, page.headings),
      signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 8) : [],
      summary: parsed.summary ?? `AI probability: ${Math.round(aiScore * 100)}%.`,
      reasoning: '', writingStyle: '',
    }
  } catch { return null }
}

// ── Sub-page crawler (parallel, article-first) ────────────────────────────────
async function crawlSubPages(links: PageData['links'], maxPages = 5): Promise<SubPageResult[]> {
  const toVisit = links
    .filter(l => l.isInternal && l.text.length > 10 && !/contact|about|privacy|terms|login|signup|cart|checkout|sitemap|feed|rss/i.test(l.text + l.url))
    .slice(0, maxPages)

  const results = await Promise.allSettled(toVisit.map(async (link) => {
    try {
      assertSafeUrl(link.url)
      const { html } = await fetchPage(link.url)
      const page = parseHTML(html, link.url, 'direct')
      if (page.wordCount < 50) return null
      const hf = await analyzeTextHF(page.textContent.slice(0, 600))
      return { url: link.url, title: page.title, contentType: page.contentType, wordCount: page.wordCount, aiScore: hf.aiScore, verdict: hf.verdict, snippet: page.textContent.slice(0, 500) } satisfies SubPageResult
    } catch { return null }
  }))
  return results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => (r as PromiseFulfilledResult<SubPageResult>).value)
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('scraper', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  let userId: string | null = null
  try { const { userId: uid } = await auth(); userId = uid } catch {}

  try {
    const body = await req.json().catch(() => ({}))
    const { url, depth = 1, maxSubPages = 3 } = body

    if (!url || typeof url !== 'string')
      return NextResponse.json({ success: false, error: { code: 'NO_URL', message: 'No URL provided' } }, { status: 400 })

    const normalised = url.startsWith('http') ? url : `https://${url}`
    let urlObj: URL
    try { urlObj = new URL(normalised) } catch {
      return NextResponse.json({ success: false, error: { code: 'INVALID_URL', message: 'Invalid URL format' } }, { status: 400 })
    }
    assertSafeUrl(normalised)

    const screenshotUrl = getScreenshotUrl(normalised)

    let html: string
    let fetchMethod: PageData['fetchMethod']
    try {
      const f = await fetchPage(normalised); html = f.html; fetchMethod = f.fetchMethod
    } catch (fetchErr) {
      return NextResponse.json({ success: false, error: { code: 'FETCH_FAILED', message: 'Could not fetch this page. The site may block automated access. Try a specific article URL.' } }, { status: 422 })
    }

    const mainPage = parseHTML(html, normalised, fetchMethod)
    if (mainPage.wordCount < 30)
      return NextResponse.json({ success: false, error: { code: 'NO_CONTENT', message: 'Not enough readable text found. Try a blog post or article URL.' } }, { status: 422 })

    const subPageResults = depth > 0 ? await crawlSubPages(mainPage.links, maxSubPages) : []

    let analysis: ContentAnalysis
    let engineTier = 1

    const buildHFAnalysis = async (): Promise<ContentAnalysis> => {
      engineTier = 4
      const hf = await analyzeTextHF(mainPage.textContent.slice(0, 1200))
      return {
        aiScore: hf.aiScore, verdict: hf.verdict as 'AI' | 'HUMAN' | 'UNCERTAIN',
        confidence: Math.round(Math.abs(hf.aiScore - 0.5) * 200),
        contentQuality: scoreContentQuality(mainPage.textContent, mainPage.wordCount, mainPage.headings),
        signals: [{ name: 'Neural Text Classifier', flagged: hf.verdict === 'AI', description: hf.verdict === 'AI' ? 'Statistical patterns strongly suggest AI generation' : 'Statistical patterns suggest human authorship', weight: 1.0 }],
        summary: `AI probability: ${Math.round(hf.aiScore * 100)}%. ${hf.verdict === 'AI' ? 'Strong AI-generation signals detected.' : hf.verdict === 'HUMAN' ? 'Content appears human-written.' : 'Origin uncertain.'}`,
        reasoning: '', writingStyle: '',
      }
    }

    if (geminiAvailable()) {
      try {
        analysis = await analyzeWithGemini(mainPage, subPageResults.map(s => s.snippet), 'gemini-2.0-flash')
        engineTier = 1
      } catch (e1: any) {
        if (/429|quota|rate.?limit|too many/i.test(e1?.message ?? '')) {
          try {
            console.warn('[scraper] gemini-2.0-flash quota — retrying 1.5-flash')
            analysis = await analyzeWithGemini(mainPage, subPageResults.map(s => s.snippet), 'gemini-1.5-flash')
            engineTier = 2
          } catch {
            const nv = await analyzeWithNVIDIA(mainPage, subPageResults.map(s => s.snippet))
            if (nv) { analysis = nv; engineTier = 3 } else analysis = await buildHFAnalysis()
          }
        } else throw e1
      }
    } else {
      analysis = await buildHFAnalysis()
    }

    // Save scan to Supabase (fire-and-forget)
    if (userId) {
      getSupabaseAdmin().from('scans').insert({
        user_id:          userId,
        media_type:       'url',
        source_url:       normalised,
        content_preview:  (mainPage.description || mainPage.title)?.slice(0, 300),
        verdict:          analysis.verdict,
        confidence_score: analysis.aiScore,
        signals:          analysis.signals,
        model_used:       `rag-t${engineTier}`,
        status:           'complete',
        metadata: { domain: urlObj.hostname, word_count: mainPage.wordCount, content_type: mainPage.contentType, fetch_method: fetchMethod, sub_pages: subPageResults.length },
      }).then(({ error }) => { if (error) console.error('[scraper] DB save:', error.message) })
    }

    return NextResponse.json({
      success: true,
      data: {
        url: normalised, domain: urlObj.hostname, title: mainPage.title,
        description:      mainPage.description || `Content from ${urlObj.hostname}`,
        author:           mainPage.author,       language:       mainPage.language,
        publish_date:     mainPage.publishDate,  content_type:   mainPage.contentType,
        word_count:       mainPage.wordCount,    content_quality:analysis.contentQuality,
        overall_ai_score: Math.round(analysis.aiScore * 100), verdict: analysis.verdict,
        confidence:       analysis.confidence,   summary:        analysis.summary,
        reasoning:        analysis.reasoning,    writing_style:  analysis.writingStyle,
        signals:          analysis.signals,      screenshot_url: screenshotUrl,
        image_urls:       mainPage.imageUrls.slice(0, 8),
        headings:         mainPage.headings.slice(0, 6),
        fetch_method:     fetchMethod,
        sub_pages: subPageResults.map(sp => ({ url: sp.url, title: sp.title, content_type: sp.contentType, word_count: sp.wordCount, ai_score: Math.round(sp.aiScore * 100), verdict: sp.verdict, snippet: sp.snippet })),
        discovered_links: mainPage.links.slice(0, 20).map(l => ({ url: l.url, text: l.text, is_internal: l.isInternal })),
        total_links: mainPage.links.length, status: 'complete',
      },
    })
  } catch (err: unknown) {
    const msg       = (err as Error)?.message || 'Scan failed'
    const isBlocked = /403|blocked|CORS|ERR_|ECONNREFUSED|strategies failed/i.test(msg)
    return NextResponse.json({ success: false, error: { code: isBlocked ? 'BLOCKED' : 'SCRAPE_FAILED', message: isBlocked ? 'This website blocks automated access. Try a specific article or blog post URL.' : 'Scan encountered an unexpected error. Please try again.' } }, { status: 500 })
  }
}

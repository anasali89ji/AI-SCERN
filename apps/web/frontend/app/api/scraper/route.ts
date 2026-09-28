export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { fetchWithProxy }             from '@/lib/proxy/fetch-with-proxy'
import { geminiAvailable }            from '@/lib/inference/gemini-analyzer'
import { GoogleGenerativeAI }         from '@google/generative-ai'
import { assertSafeUrl }              from '@/lib/utils/ssrf-guard'
import { getSupabaseAdmin }           from '@/lib/supabase/admin'
import * as cheerio                   from 'cheerio'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────
interface PageData {
  url: string; title: string; description: string; textContent: string
  wordCount: number; contentType: 'article'|'product'|'homepage'|'forum'|'documentation'|'other'
  links: { url: string; text: string; isInternal: boolean }[]
  imageUrls: string[]; ogImage?: string; publishDate?: string; author?: string
  language?: string; headings: string[]; metaKeywords?: string
  fetchMethod: 'direct'|'jina'|'cache'
}
interface DetectionSignal { name: string; flagged: boolean; description: string; weight: number }
interface ContentAnalysis {
  aiScore: number; verdict: 'AI'|'HUMAN'|'UNCERTAIN'; confidence: number
  contentQuality: 'high'|'medium'|'low'; signals: DetectionSignal[]
  summary: string; reasoning: string; writingStyle: string
}
interface AgentResult { page: PageData; aiScore: number; verdict: string; snippet: string }

const STEALTH: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none', 'Upgrade-Insecure-Requests': '1', 'DNT': '1',
}
const NOISE_SELECTORS = [
  'script','style','nav','footer','header','aside',
  '.ads','.advertisement','.ad-container','#cookie-banner','.cookie','.gdpr',
  '.popup','.modal','.newsletter','.sidebar','.related-posts','.social-share',
  '[class*="cookie"]','[id*="cookie"]','[class*="popup"]','[class*="overlay"]',
  '[class*="modal"]','[class*="ad-"]','[id*="ad-"]','noscript',
  '.comments','#comments','.comment-section','.disqus',
]
const CONTENT_SELECTORS = [
  'article','main','[role="main"]','.post-content','.article-content','.entry-content',
  '.post-body','.article-body','.story-body','.blog-content','.page-content',
  '[class*="article"]','[class*="post-body"]','[class*="entry"]','#content','.content','#main',
]

// ── Strategy: race Direct vs Jina (whichever wins first) ──────────────────────
async function fetchDirect(url: string): Promise<string | null> {
  try {
    const res = await fetchWithProxy(url, { timeoutMs: 10000, maxRetries: 1, headers: STEALTH })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return null
    const html = await res.text()
    return html.length > 300 ? html : null
  } catch { return null }
}

async function fetchJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/html', 'X-Return-Format': 'html', 'X-Timeout': '18', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length < 300) return null
    return text.startsWith('<!') ? text : `<html><body>${text}</body></html>`
  } catch { return null }
}

async function fetchCache(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}&hl=en`,
      { headers: { 'User-Agent': STEALTH['User-Agent'] }, signal: AbortSignal.timeout(8_000) }
    )
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 300 ? html : null
  } catch { return null }
}

// Race Direct vs Jina concurrently — first success wins; fallback to cache
async function fetchPage(url: string): Promise<{ html: string; fetchMethod: PageData['fetchMethod'] }> {
  // Start both simultaneously
  const directP = fetchDirect(url)
  const jinaP   = fetchJina(url)

  // Race them — first non-null result wins
  const winner = await Promise.race([
    directP.then(h => h ? { html: h, src: 'direct' as const } : null),
    jinaP.then(h => h ? { html: h, src: 'jina' as const } : null),
    new Promise<null>(r => setTimeout(() => r(null), 11_000)),
  ])

  if (winner) return { html: winner.html, fetchMethod: winner.src }

  // Wait for slower of the two
  const [d, j] = await Promise.all([directP, jinaP])
  if (d) return { html: d, fetchMethod: 'direct' }
  if (j) return { html: j, fetchMethod: 'jina' }

  // Final: Google cache
  const cached = await fetchCache(url)
  if (cached) return { html: cached, fetchMethod: 'cache' }

  throw new Error('All fetch strategies failed — site may block automated access')
}

// ── HTML Parser ───────────────────────────────────────────────────────────────
function parseHTML(html: string, baseUrl: string, fetchMethod: PageData['fetchMethod']): PageData {
  const url = new URL(baseUrl)
  const $ = cheerio.load(html)
  $(NOISE_SELECTORS.join(', ')).remove()

  const ogImage     = $('meta[property="og:image"]').attr('content')?.trim() ||
                      $('meta[name="twitter:image"]').attr('content')?.trim() || undefined
  const title       = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim() || $('h1').first().text().trim() || url.hostname
  const description = $('meta[property="og:description"]').attr('content')?.trim() || $('meta[name="description"]').attr('content')?.trim() || ''
  const author      = $('meta[name="author"]').attr('content')?.trim() || $('[rel="author"]').first().text().trim() || $('[itemprop="author"]').first().text().trim() || undefined
  const publishDate = $('meta[property="article:published_time"]').attr('content') || $('time[datetime]').first().attr('datetime') || undefined
  const language    = $('html').attr('lang')?.slice(0, 5) || undefined
  const metaKeywords= $('meta[name="keywords"]').attr('content')?.trim() || undefined

  const headings: string[] = []
  $('h1,h2,h3').each((_, el) => { const t = $(el).text().trim(); if (t.length > 3 && headings.length < 15) headings.push(t) })

  let $main = $()
  for (const sel of CONTENT_SELECTORS) { if ($(sel).length) { $main = $(sel).first(); break } }
  const $cont = $main.length ? $main : $('body')

  const blocks: string[] = []
  $cont.find('p,h1,h2,h3,h4,blockquote,li,td').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim()
    if (t.length > 35 && blocks.length < 120) blocks.push(t.slice(0, 1200))
  })
  const textContent = blocks.join('\n\n')
  const wordCount   = textContent.split(/\s+/).filter(Boolean).length

  const full = (html + url.href).toLowerCase()
  const isArticle = /article|blog|post|news|story|editorial/i.test(full) || /\/(blog|news|article|post|story)\//i.test(url.pathname)
  const isProduct = /product|shop|buy|price|cart|checkout/i.test(full)
  const isForum   = /forum|discuss|reply|thread|reddit|quora/i.test(url.hostname + url.pathname)
  const isDocs    = /docs|documentation|api.?ref|reference|guide|manual/i.test(url.pathname)
  const contentType = isArticle ? 'article' : isProduct ? 'product' : isForum ? 'forum' : isDocs ? 'documentation' : url.pathname === '/' ? 'homepage' : 'other'

  const links: PageData['links'] = []
  $('a[href]').each((_, el) => {
    if (links.length >= 60) return
    try {
      let href = $(el).attr('href')?.trim() || ''
      if (href.startsWith('//')) href = `https:${href}`
      else if (href.startsWith('/')) href = `${url.origin}${href}`
      const lu = new URL(href)
      const lt = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120)
      if (lu.protocol.startsWith('http') && lt.length > 2 && !href.includes('#'))
        links.push({ url: lu.href, text: lt, isInternal: lu.hostname === url.hostname })
    } catch {}
  })

  const imageUrls: string[] = []
  $('img[src],img[data-src],img[data-lazy-src]').each((_, el) => {
    if (imageUrls.length >= 12) return
    try {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
      if (src.startsWith('//')) src = `https:${src}`
      else if (src.startsWith('/')) src = `${url.origin}${src}`
      if (src.startsWith('http') && !src.includes('tracking') && !src.includes('pixel') && !src.includes('1x1') && src.length < 500)
        imageUrls.push(src)
    } catch {}
  })

  return { url: baseUrl, title, description, textContent, wordCount, contentType, links, imageUrls, ogImage, publishDate, author, language, headings, metaKeywords, fetchMethod }
}

// ── Screenshot — use og:image (instant) as primary, mshots as fallback ────────
function getScreenshotUrl(targetUrl: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(targetUrl)}?w=1200&h=750`
}

function scoreContentQuality(text: string, wc: number, h: string[]): 'high'|'medium'|'low' {
  if (wc < 80) return 'low'
  if (h.length >= 2 && wc > 400 && !text.includes('Lorem ipsum')) return 'high'
  if (wc > 150 && !text.includes('Lorem ipsum')) return 'medium'
  return 'low'
}

// ── HF quick scorer — used by parallel sub-agents ────────────────────────────
async function quickScoreHF(text: string): Promise<{ aiScore: number; verdict: string }> {
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
  if (!token) return { aiScore: 0.5, verdict: 'UNCERTAIN' }
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/openai-community/roberta-base-openai-detector', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text.slice(0, 512) }), signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { aiScore: 0.5, verdict: 'UNCERTAIN' }
    const data = await res.json() as { label: string; score: number }[][]
    const flat = Array.isArray(data[0]) ? data[0] : data as unknown as { label: string; score: number }[]
    const aiE = flat.find(s => /fake|label_1/i.test(s.label))
    const huE = flat.find(s => /real|label_0/i.test(s.label))
    const score = aiE?.score ?? (huE ? 1 - huE.score : 0.5)
    return { aiScore: score, verdict: score >= 0.60 ? 'AI' : score <= 0.38 ? 'HUMAN' : 'UNCERTAIN' }
  } catch { return { aiScore: 0.5, verdict: 'UNCERTAIN' } }
}

// ── Parallel Sub-page Agents ──────────────────────────────────────────────────
// Each agent fetches, parses, and quick-scores one page independently
async function runSubAgent(link: { url: string; text: string }): Promise<AgentResult | null> {
  try {
    assertSafeUrl(link.url)
    const { html, fetchMethod } = await fetchPage(link.url)
    const page = parseHTML(html, link.url, fetchMethod)
    if (page.wordCount < 50) return null
    const hf = await quickScoreHF(page.textContent.slice(0, 600))
    return { page, aiScore: hf.aiScore, verdict: hf.verdict, snippet: page.textContent.slice(0, 600) }
  } catch { return null }
}

async function runParallelAgents(links: PageData['links'], maxAgents = 4): Promise<AgentResult[]> {
  const targets = links
    .filter(l => l.isInternal && l.text.length > 8 &&
      !/contact|about|privacy|terms|login|signup|cart|checkout|sitemap|feed|rss|tag|category|author\//i.test(l.text + l.url))
    .slice(0, maxAgents)

  if (targets.length === 0) return []
  const settled = await Promise.allSettled(targets.map(l => runSubAgent(l)))
  return settled
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<AgentResult>).value)
}

// ── Gemini RAG — 12-signal deep analysis ─────────────────────────────────────
async function analyzeWithGemini(main: PageData, agents: AgentResult[], model = 'gemini-2.0-flash'): Promise<ContentAnalysis> {
  const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const mdl    = genAI.getGenerativeModel({ model })

  // Build rich multi-page context from all agents
  const agentCtx = agents.slice(0, 4).map((a, i) =>
    `AGENT ${i + 1} [${a.page.contentType}, ${a.page.wordCount}w, HF:${Math.round(a.aiScore*100)}%]:\n${a.snippet.slice(0, 700)}`
  ).join('\n\n---\n\n')

  const prompt = `You are Aiscern's AI detection engine. ${agents.length} parallel agents have pre-analyzed this website.

MAIN PAGE: ${main.contentType} | ${main.wordCount} words | fetched via ${main.fetchMethod}
Domain: ${new URL(main.url).hostname} | Lang: ${main.language||'en'} | Author: ${main.author||'unknown'} | Published: ${main.publishDate||'unknown'}
Title: "${main.title}"
Keywords: ${main.metaKeywords?.slice(0,80)||'none'}
Headings: ${main.headings.slice(0,8).join(' | ')}

MAIN CONTENT:
${main.textContent.slice(0, 3500)}
${agentCtx ? '\n\nSUB-PAGE AGENT REPORTS:\n' + agentCtx : ''}

Respond ONLY in JSON (no markdown):
{"ai_probability":0.0,"verdict":"AI","content_quality":"high","writing_style":"one sentence","summary":"2-3 sentence verdict","reasoning":"key evidence","signals":[{"name":"s","flagged":true,"description":"d","weight":0.8}]}

Score these 12 signals (honest weights):
1.Transition overuse(Furthermore/Moreover/Additionally) 2.Sentence uniformity(identical rhythm) 3.Personal voice absence(no lived experience) 4.Hedging language(vague qualifiers) 5.Structural perfection(unnaturally parallel) 6.Keyword stuffing(SEO patterns) 7.Factual vagueness(no specific names/dates) 8.Tonal flatness(no emotion variance) 9.Cross-page consistency(all sub-pages identical style) 10.Authorship absence(no byline/bio) 11.Natural imperfections absent(no typos/contractions) 12.Human specificity absent(no cultural refs/personal network)`

  const result = await mdl.generateContent(prompt)
  const raw    = result.response.text()
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    const p = JSON.parse(m ? m[0] : raw.replace(/```json\n?|\n?```/g, '').trim())
    const s = Math.max(0, Math.min(1, p.ai_probability ?? 0.5))
    return {
      aiScore: s, verdict: s >= 0.60 ? 'AI' : s <= 0.38 ? 'HUMAN' : 'UNCERTAIN',
      confidence: Math.round(Math.abs(s - 0.5) * 200),
      contentQuality: p.content_quality ?? scoreContentQuality(main.textContent, main.wordCount, main.headings),
      signals: Array.isArray(p.signals) ? p.signals.slice(0, 12) : [],
      summary: p.summary ?? `AI probability: ${Math.round(s*100)}%.`,
      reasoning: p.reasoning ?? '', writingStyle: p.writing_style ?? '',
    }
  } catch {
    const m2 = raw.match(/"ai_probability"\s*:\s*([\d.]+)/)
    const s  = m2 ? Math.max(0, Math.min(1, parseFloat(m2[1]))) : 0.5
    return { aiScore: s, verdict: 'UNCERTAIN', confidence: 0, contentQuality: 'medium', signals: [], summary: 'Partial analysis — retry for full results.', reasoning: '', writingStyle: '' }
  }
}

// ── NVIDIA fallback ───────────────────────────────────────────────────────────
async function analyzeWithNVIDIA(main: PageData, agents: AgentResult[]): Promise<ContentAnalysis | null> {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY
  if (!apiKey) return null
  const ctx = [main.textContent.slice(0, 1800), ...agents.slice(0, 2).map(a => a.snippet.slice(0, 300))].join('\n---\n')
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: `JSON only — analyze for AI generation:\n{"ai_probability":0.0,"verdict":"AI","summary":"analysis","signals":[{"name":"s","flagged":true,"description":"d","weight":0.8}]}\n\nContent: ${ctx}` }],
        temperature: 0.1, max_tokens: 400,
      }),
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return null
    const data  = await res.json() as { choices: { message: { content: string } }[] }
    const raw   = data.choices?.[0]?.message?.content ?? ''
    const m     = raw.match(/\{[\s\S]*\}/)
    const p     = JSON.parse(m ? m[0] : raw.replace(/```json\n?|\n?```/g, '').trim())
    const score = Math.max(0, Math.min(1, p.ai_probability ?? 0.5))
    return {
      aiScore: score, verdict: score >= 0.60 ? 'AI' : score <= 0.38 ? 'HUMAN' : 'UNCERTAIN',
      confidence: Math.round(Math.abs(score - 0.5) * 200),
      contentQuality: scoreContentQuality(main.textContent, main.wordCount, main.headings),
      signals: Array.isArray(p.signals) ? p.signals.slice(0, 8) : [],
      summary: p.summary ?? `AI probability: ${Math.round(score*100)}%.`,
      reasoning: '', writingStyle: '',
    }
  } catch { return null }
}

// ── Main POST ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth required — prevents free Gemini quota abuse
  const { userId } = await auth().catch(() => ({ userId: null as string | null }))
  if (!userId) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to use the Web Scanner' } }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('scraper', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  try {
    const body = await req.json().catch(() => ({}))
    const { url, depth = 1, maxSubPages = 4 } = body
    if (!url || typeof url !== 'string')
      return NextResponse.json({ success: false, error: { code: 'NO_URL', message: 'No URL provided' } }, { status: 400 })

    const normalised = url.startsWith('http') ? url : `https://${url}`
    let urlObj: URL
    try { urlObj = new URL(normalised) } catch {
      return NextResponse.json({ success: false, error: { code: 'INVALID_URL', message: 'Invalid URL format' } }, { status: 400 })
    }
    assertSafeUrl(normalised)

    // Fetch main page
    let html: string; let fetchMethod: PageData['fetchMethod']
    try { const f = await fetchPage(normalised); html = f.html; fetchMethod = f.fetchMethod }
    catch {
      return NextResponse.json({ success: false, error: { code: 'FETCH_FAILED', message: 'Could not fetch this page. The site may block automated access. Try a specific article or post URL.' } }, { status: 422 })
    }

    const mainPage = parseHTML(html, normalised, fetchMethod)
    if (mainPage.wordCount < 30)
      return NextResponse.json({ success: false, error: { code: 'NO_CONTENT', message: 'Not enough readable text. Try a blog post or article URL.' } }, { status: 422 })

    // ── PARALLEL: run sub-agents + HF quick-score concurrently ────────────────
    const [agentResults, hfQuick] = await Promise.all([
      depth > 0 ? runParallelAgents(mainPage.links, maxSubPages) : Promise.resolve([]),
      quickScoreHF(mainPage.textContent.slice(0, 800)),
    ])

    // ── Deep analysis — Gemini (with fallback chain) ───────────────────────────
    let analysis: ContentAnalysis
    let tier = 1

    const hfFallback = (): ContentAnalysis => ({
      aiScore: hfQuick.aiScore, verdict: hfQuick.verdict as 'AI'|'HUMAN'|'UNCERTAIN',
      confidence: Math.round(Math.abs(hfQuick.aiScore - 0.5) * 200),
      contentQuality: scoreContentQuality(mainPage.textContent, mainPage.wordCount, mainPage.headings),
      signals: [{ name: 'Neural Text Classifier', flagged: hfQuick.verdict === 'AI', description: hfQuick.verdict === 'AI' ? 'Statistical patterns suggest AI generation' : 'Statistical patterns suggest human authorship', weight: 1.0 }],
      summary: `AI probability: ${Math.round(hfQuick.aiScore * 100)}%.`,
      reasoning: '', writingStyle: '',
    })

    if (geminiAvailable()) {
      try {
        analysis = await analyzeWithGemini(mainPage, agentResults, 'gemini-2.0-flash'); tier = 1
      } catch (e1: any) {
        if (/429|quota|rate.?limit|too many/i.test(e1?.message ?? '')) {
          try { analysis = await analyzeWithGemini(mainPage, agentResults, 'gemini-1.5-flash'); tier = 2 }
          catch {
            const nv = await analyzeWithNVIDIA(mainPage, agentResults)
            if (nv) { analysis = nv; tier = 3 } else { analysis = hfFallback(); tier = 4 }
          }
        } else throw e1
      }
    } else {
      analysis = hfFallback(); tier = 4
    }

    // Weighted cross-agent score (blend HF sub-scores with Gemini)
    if (agentResults.length > 0) {
      const agentAvg = agentResults.reduce((a, r) => a + r.aiScore, 0) / agentResults.length
      analysis.aiScore = +(analysis.aiScore * 0.75 + agentAvg * 0.25).toFixed(3)
      analysis.verdict = analysis.aiScore >= 0.60 ? 'AI' : analysis.aiScore <= 0.38 ? 'HUMAN' : 'UNCERTAIN'
    }

    // Save scan (fire-and-forget)
    getSupabaseAdmin().from('scans').insert({
      user_id: userId, media_type: 'url', source_url: normalised,
      content_preview: (mainPage.description || mainPage.title)?.slice(0, 300),
      verdict: analysis.verdict, confidence_score: analysis.aiScore,
      signals: analysis.signals, model_used: `rag-t${tier}`, status: 'complete',
      metadata: { domain: urlObj.hostname, word_count: mainPage.wordCount, content_type: mainPage.contentType, fetch_method: fetchMethod, agents: agentResults.length },
    }).then(({ error }) => { if (error) console.error('[scraper] DB save:', error.message) })

    return NextResponse.json({
      success: true,
      data: {
        url: normalised, domain: urlObj.hostname, title: mainPage.title,
        description:      mainPage.description || `Content from ${urlObj.hostname}`,
        author:           mainPage.author,       language:      mainPage.language,
        publish_date:     mainPage.publishDate,  content_type:  mainPage.contentType,
        word_count:       mainPage.wordCount,    content_quality: analysis.contentQuality,
        overall_ai_score: Math.round(analysis.aiScore * 100),
        verdict:          analysis.verdict,      confidence:    analysis.confidence,
        summary:          analysis.summary,      reasoning:     analysis.reasoning,
        writing_style:    analysis.writingStyle, signals:       analysis.signals,
        // Instant preview: og:image loads immediately, screenshot is background fallback
        og_image:         mainPage.ogImage,
        screenshot_url:   getScreenshotUrl(normalised),
        image_urls:       mainPage.imageUrls.slice(0, 8),
        headings:         mainPage.headings.slice(0, 6),
        fetch_method:     fetchMethod,
        agents_used:      agentResults.length,
        sub_pages: agentResults.map(a => ({
          url: a.page.url, title: a.page.title, content_type: a.page.contentType,
          word_count: a.page.wordCount, ai_score: Math.round(a.aiScore * 100),
          verdict: a.verdict, snippet: a.snippet,
        })),
        discovered_links: mainPage.links.slice(0, 20).map(l => ({ url: l.url, text: l.text, is_internal: l.isInternal })),
        total_links: mainPage.links.length, status: 'complete',
      },
    })
  } catch (err: unknown) {
    const msg = (err as Error)?.message || ''
    const isBlocked = /403|blocked|CORS|ERR_|ECONNREFUSED|strategies failed/i.test(msg)
    return NextResponse.json({ success: false, error: { code: isBlocked ? 'BLOCKED' : 'SCRAPE_FAILED', message: isBlocked ? 'This website blocks automated access. Try a specific article or blog post URL.' : 'Scan failed unexpectedly. Please try again.' } }, { status: 500 })
  }
}

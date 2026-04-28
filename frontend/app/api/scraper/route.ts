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
  fetchMethod: FetchMethod
  techStack?: string[]
  structuredData?: Record<string, unknown>[]
}
type FetchMethod = 'browserbase'|'firecrawl'|'jina-auth'|'direct'|'jina'|'cache'
interface DetectionSignal { name: string; flagged: boolean; description: string; weight: number }
interface ContentAnalysis {
  aiScore: number; verdict: 'AI'|'HUMAN'|'UNCERTAIN'; confidence: number
  contentQuality: 'high'|'medium'|'low'; signals: DetectionSignal[]
  summary: string; reasoning: string; writingStyle: string
}
interface AgentResult { page: PageData; aiScore: number; verdict: string; snippet: string }
interface SitemapEntry { url: string; priority?: number; changefreq?: string }

// ── DOM noise / content selectors ────────────────────────────────────────────
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
const STEALTH: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none', 'Upgrade-Insecure-Requests': '1', 'DNT': '1',
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER 1 — BrowserBase (cloud browser, full JS rendering + screenshot)
// Env: BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchBrowserBase(url: string): Promise<{ html: string; screenshotUrl?: string } | null> {
  const apiKey    = process.env.BROWSERBASE_API_KEY
  const projectId = process.env.BROWSERBASE_PROJECT_ID
  if (!apiKey || !projectId) return null

  try {
    // Create a session
    const sessionRes = await fetch('https://www.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BB-API-Key': apiKey },
      body: JSON.stringify({ projectId, browserSettings: { viewport: { width: 1440, height: 900 } } }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!sessionRes.ok) return null
    const { id: sessionId } = await sessionRes.json() as { id: string }

    // Fetch page via session (uses Selenium WebDriver protocol)
    const pageRes = await fetch(`https://www.browserbase.com/v1/sessions/${sessionId}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BB-API-Key': apiKey },
      body: JSON.stringify({ url, waitFor: 'networkidle', timeout: 20000 }),
      signal: AbortSignal.timeout(28_000),
    })
    if (!pageRes.ok) return null
    const { html } = await pageRes.json() as { html: string }

    // Request screenshot (non-blocking)
    const ssRes = await fetch(`https://www.browserbase.com/v1/sessions/${sessionId}/screenshot`, {
      headers: { 'X-BB-API-Key': apiKey }, signal: AbortSignal.timeout(10_000),
    }).catch(() => null)
    const screenshotUrl = ssRes?.ok ? (await ssRes.json() as { url?: string }).url : undefined

    // Close session (fire-and-forget)
    fetch(`https://www.browserbase.com/v1/sessions/${sessionId}`, {
      method: 'DELETE', headers: { 'X-BB-API-Key': apiKey },
    }).catch(() => {})

    return html?.length > 300 ? { html, screenshotUrl } : null
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER 2 — Firecrawl (managed browser crawler — returns clean markdown + HTML)
// Env: FIRECRAWL_API_KEY
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchFirecrawl(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        url,
        formats: ['html', 'markdown'],
        actions: [{ type: 'wait', milliseconds: 2000 }],
        onlyMainContent: false,
        includeTags: ['article', 'main', 'section', 'p', 'h1', 'h2', 'h3'],
        timeout: 25000,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { success: boolean; data?: { html?: string; markdown?: string } }
    if (!data.success) return null
    const html = data.data?.html || (data.data?.markdown ? `<html><body>${data.data.markdown}</body></html>` : null)
    return html && html.length > 300 ? html : null
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER 3 — Jina AI Reader (authenticated — higher rate limit + better extraction)
// Env: JINA_API_KEY
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchJinaAuth(url: string): Promise<string | null> {
  const apiKey = process.env.JINA_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/html',
        'X-Return-Format': 'html',
        'X-Timeout': '25',
        'X-No-Cache': 'true',
        'X-With-Images-Summary': 'true',
        'X-With-Links-Summary': 'true',
      },
      signal: AbortSignal.timeout(28_000),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length < 300) return null
    return text.startsWith('<!') ? text : `<html><body>${text}</body></html>`
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER 4 — Direct fetch (fastest, fails on JS-heavy SPAs)
// ═══════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════
// TIER 5 — Jina free (no key required, lower rate limit)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchJinaFree(url: string): Promise<string | null> {
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

// ═══════════════════════════════════════════════════════════════════════════════
// TIER 6 — Google Cache (last resort)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchGoogleCache(url: string): Promise<string | null> {
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

// ── Master fetch orchestrator — tries each tier in order ─────────────────────
async function fetchPage(url: string): Promise<{ html: string; fetchMethod: FetchMethod; screenshotUrl?: string }> {
  // Tier 1: BrowserBase (full JS browser — best for SPAs and JS-heavy sites)
  const bb = await fetchBrowserBase(url)
  if (bb) return { html: bb.html, fetchMethod: 'browserbase', screenshotUrl: bb.screenshotUrl }

  // Tier 2 + 3 + 4: race Firecrawl vs Jina-auth vs Direct — first non-null wins
  const [firecrawlP, jinaAuthP, directP] = [
    fetchFirecrawl(url),
    fetchJinaAuth(url),
    fetchDirect(url),
  ]
  const winner = await Promise.race([
    firecrawlP.then(h => h ? { html: h, src: 'firecrawl' as FetchMethod } : null),
    jinaAuthP.then(h  => h ? { html: h, src: 'jina-auth' as FetchMethod } : null),
    directP.then(h    => h ? { html: h, src: 'direct'    as FetchMethod } : null),
    new Promise<null>(r => setTimeout(() => r(null), 14_000)),
  ])
  if (winner) return { html: winner.html, fetchMethod: winner.src }

  // Settle remaining
  const [fc, ja, d] = await Promise.all([firecrawlP, jinaAuthP, directP])
  if (fc) return { html: fc, fetchMethod: 'firecrawl' }
  if (ja) return { html: ja, fetchMethod: 'jina-auth' }
  if (d)  return { html: d,  fetchMethod: 'direct' }

  // Tier 5: Jina free
  const jf = await fetchJinaFree(url)
  if (jf) return { html: jf, fetchMethod: 'jina' }

  // Tier 6: Google Cache
  const gc = await fetchGoogleCache(url)
  if (gc) return { html: gc, fetchMethod: 'cache' }

  throw new Error('All fetch strategies failed — site may block automated access')
}

// ── Sitemap parser — discovers pages for deep crawl ──────────────────────────
async function fetchSitemap(baseUrl: string): Promise<SitemapEntry[]> {
  const origin = new URL(baseUrl).origin
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`]

  for (const sitemapUrl of candidates) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': STEALTH['User-Agent'] },
        signal: AbortSignal.timeout(6_000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) continue

      const $ = cheerio.load(xml, { xmlMode: true })
      const entries: SitemapEntry[] = []

      // Handle sitemap index — fetch first child sitemap
      const childSitemaps: string[] = []
      $('sitemap > loc').each((_, el) => { childSitemaps.push($(el).text().trim()) })
      if (childSitemaps.length > 0) {
        for (const child of childSitemaps.slice(0, 2)) {
          try {
            const cRes = await fetch(child, { headers: { 'User-Agent': STEALTH['User-Agent'] }, signal: AbortSignal.timeout(5_000) })
            if (!cRes.ok) continue
            const cXml = await cRes.text()
            const c$ = cheerio.load(cXml, { xmlMode: true })
            c$('url').each((_, el) => {
              const loc  = c$(el).find('loc').text().trim()
              const pri  = parseFloat(c$(el).find('priority').text()) || undefined
              const freq = c$(el).find('changefreq').text().trim() || undefined
              if (loc && entries.length < 80) entries.push({ url: loc, priority: pri, changefreq: freq })
            })
          } catch {}
        }
        if (entries.length > 0) return entries
      }

      // Regular sitemap
      $('url').each((_, el) => {
        const loc  = $(el).find('loc').text().trim()
        const pri  = parseFloat($(el).find('priority').text()) || undefined
        const freq = $(el).find('changefreq').text().trim() || undefined
        if (loc && entries.length < 80) entries.push({ url: loc, priority: pri, changefreq: freq })
      })
      if (entries.length > 0) return entries
    } catch {}
  }
  return []
}

// ── Tech stack detector ───────────────────────────────────────────────────────
function detectTechStack(html: string, headers?: Record<string, string>): string[] {
  const stack: string[] = []
  const h = html.toLowerCase()

  // JS frameworks
  if (h.includes('__next') || h.includes('_next/static'))         stack.push('Next.js')
  else if (h.includes('__nuxt') || h.includes('_nuxt/'))          stack.push('Nuxt.js')
  else if (h.includes('ng-version') || h.includes('ng-app'))      stack.push('Angular')
  else if (h.includes('data-reactroot') || h.includes('reactdom')) stack.push('React')
  else if (h.includes('data-svelte') || h.includes('__svelte'))   stack.push('Svelte')

  // CMS
  if (h.includes('wp-content') || h.includes('wp-includes'))      stack.push('WordPress')
  else if (h.includes('shopify') || h.includes('myshopify'))      stack.push('Shopify')
  else if (h.includes('webflow') || h.includes('.webflow.io'))    stack.push('Webflow')
  else if (h.includes('ghost.io') || h.includes('ghost-access'))  stack.push('Ghost')
  else if (h.includes('squarespace'))                              stack.push('Squarespace')
  else if (h.includes('wix.com') || h.includes('wixsite'))        stack.push('Wix')

  // AI platforms
  if (h.includes('jasper') || h.includes('jasper.ai'))            stack.push('Jasper AI')
  if (h.includes('copy.ai') || h.includes('copyai'))              stack.push('Copy.ai')
  if (h.includes('writesonic'))                                    stack.push('Writesonic')
  if (h.includes('contentful'))                                    stack.push('Contentful')

  // Analytics
  if (h.includes('google-analytics') || h.includes('gtag('))      stack.push('Google Analytics')
  if (h.includes('segment.com') || h.includes('analytics.js'))    stack.push('Segment')

  return [...new Set(stack)].slice(0, 6)
}

// ── Structured data extractor (JSON-LD) ───────────────────────────────────────
function extractStructuredData($: ReturnType<typeof cheerio.load>): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}')
      if (data && typeof data === 'object') results.push(data)
    } catch {}
  })
  return results.slice(0, 5)
}

// ── HTML Parser ───────────────────────────────────────────────────────────────
function parseHTML(html: string, baseUrl: string, fetchMethod: FetchMethod): PageData {
  const url = new URL(baseUrl)
  const $ = cheerio.load(html)
  $(NOISE_SELECTORS.join(', ')).remove()

  const ogImage      = $('meta[property="og:image"]').attr('content')?.trim() || $('meta[name="twitter:image"]').attr('content')?.trim() || undefined
  const title        = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim() || $('h1').first().text().trim() || url.hostname
  const description  = $('meta[property="og:description"]').attr('content')?.trim() || $('meta[name="description"]').attr('content')?.trim() || ''
  const author       = $('meta[name="author"]').attr('content')?.trim() || $('[rel="author"]').first().text().trim() || $('[itemprop="author"]').first().text().trim() || undefined
  const publishDate  = $('meta[property="article:published_time"]').attr('content') || $('time[datetime]').first().attr('datetime') || undefined
  const language     = $('html').attr('lang')?.slice(0, 5) || undefined
  const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim() || undefined

  const headings: string[] = []
  $('h1,h2,h3').each((_, el) => { const t = $(el).text().trim(); if (t.length > 3 && headings.length < 20) headings.push(t) })

  let $main = $()
  for (const sel of CONTENT_SELECTORS) { if ($(sel).length) { $main = $(sel).first(); break } }
  const $cont = $main.length ? $main : $('body')

  const blocks: string[] = []
  $cont.find('p,h1,h2,h3,h4,blockquote,li,td').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim()
    if (t.length > 35 && blocks.length < 150) blocks.push(t.slice(0, 1200))
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
    if (links.length >= 80) return
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
    if (imageUrls.length >= 16) return
    try {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
      if (src.startsWith('//')) src = `https:${src}`
      else if (src.startsWith('/')) src = `${url.origin}${src}`
      if (src.startsWith('http') && !src.includes('tracking') && !src.includes('pixel') && src.length < 500)
        imageUrls.push(src)
    } catch {}
  })

  const techStack     = detectTechStack(html)
  const structuredData = extractStructuredData($)

  return { url: baseUrl, title, description, textContent, wordCount, contentType, links, imageUrls, ogImage, publishDate, author, language, headings, metaKeywords, fetchMethod, techStack, structuredData }
}

// ── Screenshot URL ────────────────────────────────────────────────────────────
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
    const aiE  = flat.find(s => /fake|label_1/i.test(s.label))
    const huE  = flat.find(s => /real|label_0/i.test(s.label))
    const score = aiE?.score ?? (huE ? 1 - huE.score : 0.5)
    return { aiScore: score, verdict: score >= 0.60 ? 'AI' : score <= 0.38 ? 'HUMAN' : 'UNCERTAIN' }
  } catch { return { aiScore: 0.5, verdict: 'UNCERTAIN' } }
}

// ── Parallel sub-page agent ───────────────────────────────────────────────────
async function runSubAgent(link: { url: string; text: string }): Promise<AgentResult | null> {
  try {
    assertSafeUrl(link.url)
    // Agents use lightweight fetch only (no BrowserBase — save quota for main page)
    const html = await fetchJinaAuth(link.url) || await fetchDirect(link.url) || await fetchJinaFree(link.url)
    if (!html) return null
    const page = parseHTML(html, link.url, 'direct')
    if (page.wordCount < 50) return null
    const hf = await quickScoreHF(page.textContent.slice(0, 600))
    return { page, aiScore: hf.aiScore, verdict: hf.verdict, snippet: page.textContent.slice(0, 600) }
  } catch { return null }
}

// ── Smart page selector — prioritises content pages from sitemap ──────────────
function selectDeepCrawlTargets(
  links: PageData['links'],
  sitemap: SitemapEntry[],
  origin: string,
  maxAgents: number
): { url: string; text: string }[] {
  const SKIP = /contact|about|privacy|terms|login|signup|cart|checkout|sitemap|feed|rss|tag|category|author\//i

  // Prefer sitemap entries (higher quality pages, sorted by priority)
  const sitemapTargets = sitemap
    .filter(e => {
      try {
        const u = new URL(e.url)
        return u.origin === origin && !SKIP.test(e.url) && u.pathname !== '/'
      } catch { return false }
    })
    .sort((a, b) => (b.priority ?? 0.5) - (a.priority ?? 0.5))
    .slice(0, maxAgents)
    .map(e => ({ url: e.url, text: e.url.split('/').filter(Boolean).pop() || e.url }))

  if (sitemapTargets.length >= maxAgents) return sitemapTargets

  // Supplement with internal links from main page
  const linkTargets = links
    .filter(l => l.isInternal && l.text.length > 8 && !SKIP.test(l.text + l.url))
    .slice(0, maxAgents - sitemapTargets.length)

  const seen = new Set(sitemapTargets.map(t => t.url))
  const merged = [...sitemapTargets]
  for (const l of linkTargets) {
    if (!seen.has(l.url)) { seen.add(l.url); merged.push(l) }
  }
  return merged.slice(0, maxAgents)
}

async function runParallelAgents(
  links: PageData['links'],
  sitemap: SitemapEntry[],
  origin: string,
  maxAgents = 8
): Promise<AgentResult[]> {
  const targets = selectDeepCrawlTargets(links, sitemap, origin, maxAgents)
  if (targets.length === 0) return []
  const settled = await Promise.allSettled(targets.map(l => runSubAgent(l)))
  return settled
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<AgentResult>).value)
}

// ── Gemini RAG — 12-signal deep analysis with tech stack context ──────────────
async function analyzeWithGemini(main: PageData, agents: AgentResult[], sitemap: SitemapEntry[], model = 'gemini-2.0-flash'): Promise<ContentAnalysis> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const mdl   = genAI.getGenerativeModel({ model })

  const agentCtx = agents.slice(0, 6).map((a, i) =>
    `AGENT ${i + 1} [${a.page.contentType}, ${a.page.wordCount}w, HF:${Math.round(a.aiScore*100)}%, via:${a.page.fetchMethod}]:\n${a.snippet.slice(0, 600)}`
  ).join('\n\n---\n\n')

  const techCtx      = main.techStack?.length ? `Tech stack: ${main.techStack.join(', ')}` : ''
  const sitemapCtx   = sitemap.length > 0 ? `Sitemap discovered ${sitemap.length} pages (deep crawl enabled)` : 'No sitemap found'
  const structCtx    = main.structuredData?.length
    ? `Structured data: ${JSON.stringify(main.structuredData.slice(0, 2)).slice(0, 400)}`
    : ''

  const prompt = `You are Aiscern's AI detection engine. ${agents.length} parallel deep-crawl agents have analyzed this website.

MAIN PAGE: ${main.contentType} | ${main.wordCount} words | fetched via ${main.fetchMethod}
Domain: ${new URL(main.url).hostname} | Lang: ${main.language||'en'} | Author: ${main.author||'unknown'} | Published: ${main.publishDate||'unknown'}
Title: "${main.title}"
Keywords: ${main.metaKeywords?.slice(0,80)||'none'}
Headings: ${main.headings.slice(0,10).join(' | ')}
${techCtx}
${sitemapCtx}
${structCtx}

MAIN CONTENT:
${main.textContent.slice(0, 3500)}
${agentCtx ? '\n\nSUB-PAGE AGENT REPORTS (deep crawl):\n' + agentCtx : ''}

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
  const { userId } = await auth().catch(() => ({ userId: null as string | null }))
  if (!userId) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to use the Web Scanner' } }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('scraper', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  try {
    const body = await req.json().catch(() => ({}))
    const { url, depth = 1, maxSubPages = 8 } = body
    if (!url || typeof url !== 'string')
      return NextResponse.json({ success: false, error: { code: 'NO_URL', message: 'No URL provided' } }, { status: 400 })

    const normalised = url.startsWith('http') ? url : `https://${url}`
    let urlObj: URL
    try { urlObj = new URL(normalised) } catch {
      return NextResponse.json({ success: false, error: { code: 'INVALID_URL', message: 'Invalid URL format' } }, { status: 400 })
    }
    assertSafeUrl(normalised)

    // ── Fetch main page (tiered browser strategy) ─────────────────────────────
    let html: string; let fetchMethod: FetchMethod; let browserScreenshot: string | undefined
    try {
      const f = await fetchPage(normalised)
      html = f.html; fetchMethod = f.fetchMethod; browserScreenshot = f.screenshotUrl
    } catch {
      return NextResponse.json({ success: false, error: { code: 'FETCH_FAILED', message: 'Could not fetch this page. The site may block automated access. Try a specific article or post URL.' } }, { status: 422 })
    }

    const mainPage = parseHTML(html, normalised, fetchMethod)
    if (mainPage.wordCount < 30)
      return NextResponse.json({ success: false, error: { code: 'NO_CONTENT', message: 'Not enough readable text. Try a blog post or article URL.' } }, { status: 422 })

    // ── PARALLEL: sitemap discovery + sub-agents + HF quick-score ────────────
    const [sitemap, agentResults, hfQuick] = await Promise.all([
      depth > 0 ? fetchSitemap(normalised) : Promise.resolve([]),
      Promise.resolve([]), // agents run after sitemap (needs sitemap targets)
      quickScoreHF(mainPage.textContent.slice(0, 800)),
    ])

    // ── Deep crawl agents (use sitemap + links together) ─────────────────────
    const deepAgents = depth > 0
      ? await runParallelAgents(mainPage.links, sitemap, urlObj.origin, maxSubPages)
      : []

    // ── Deep analysis — Gemini → NVIDIA → HF fallback ────────────────────────
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
        analysis = await analyzeWithGemini(mainPage, deepAgents, sitemap, 'gemini-2.0-flash'); tier = 1
      } catch (e1: any) {
        if (/429|quota|rate.?limit|too many/i.test(e1?.message ?? '')) {
          try { analysis = await analyzeWithGemini(mainPage, deepAgents, sitemap, 'gemini-1.5-flash'); tier = 2 }
          catch {
            const nv = await analyzeWithNVIDIA(mainPage, deepAgents)
            if (nv) { analysis = nv; tier = 3 } else { analysis = hfFallback(); tier = 4 }
          }
        } else throw e1
      }
    } else {
      analysis = hfFallback(); tier = 4
    }

    // ── Weighted cross-agent score blend ─────────────────────────────────────
    if (deepAgents.length > 0) {
      const agentAvg = deepAgents.reduce((a, r) => a + r.aiScore, 0) / deepAgents.length
      analysis.aiScore = +(analysis.aiScore * 0.75 + agentAvg * 0.25).toFixed(3)
      analysis.verdict = analysis.aiScore >= 0.60 ? 'AI' : analysis.aiScore <= 0.38 ? 'HUMAN' : 'UNCERTAIN'
    }

    // ── Determine fetch tier label ────────────────────────────────────────────
    const fetchTierLabel = {
      'browserbase': 'BrowserBase (JS browser)',
      'firecrawl':   'Firecrawl (managed browser)',
      'jina-auth':   'Jina AI (authenticated)',
      'direct':      'Direct HTTP',
      'jina':        'Jina AI (free)',
      'cache':       'Google Cache',
    }[fetchMethod] ?? fetchMethod

    // ── Save scan ─────────────────────────────────────────────────────────────
    getSupabaseAdmin().from('scans').insert({
      user_id: userId, media_type: 'url', source_url: normalised,
      content_preview: (mainPage.description || mainPage.title)?.slice(0, 300),
      verdict: analysis.verdict, confidence_score: analysis.aiScore,
      signals: analysis.signals, model_used: `rag-t${tier}`, status: 'complete',
      metadata: {
        domain: urlObj.hostname, word_count: mainPage.wordCount,
        content_type: mainPage.contentType, fetch_method: fetchMethod,
        agents: deepAgents.length, sitemap_pages: sitemap.length,
        tech_stack: mainPage.techStack,
      },
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
        og_image:         mainPage.ogImage,
        screenshot_url:   browserScreenshot || getScreenshotUrl(normalised),
        image_urls:       mainPage.imageUrls.slice(0, 8),
        headings:         mainPage.headings.slice(0, 8),
        tech_stack:       mainPage.techStack,
        fetch_method:     fetchTierLabel,
        fetch_tier:       fetchMethod,
        agents_used:      deepAgents.length,
        sitemap_pages:    sitemap.length,
        sub_pages: deepAgents.map(a => ({
          url: a.page.url, title: a.page.title, content_type: a.page.contentType,
          word_count: a.page.wordCount, ai_score: Math.round(a.aiScore * 100),
          verdict: a.verdict, snippet: a.snippet, fetch_method: a.page.fetchMethod,
        })),
        discovered_links: mainPage.links.slice(0, 25).map(l => ({ url: l.url, text: l.text, is_internal: l.isInternal })),
        total_links: mainPage.links.length, status: 'complete',
      },
    })
  } catch (err: unknown) {
    const msg = (err as Error)?.message || ''
    const isBlocked = /403|blocked|CORS|ERR_|ECONNREFUSED|strategies failed/i.test(msg)
    return NextResponse.json({ success: false, error: { code: isBlocked ? 'BLOCKED' : 'SCRAPE_FAILED', message: isBlocked ? 'This website blocks automated access. Try a specific article or blog post URL.' : 'Scan failed unexpectedly. Please try again.' } }, { status: 500 })
  }
}

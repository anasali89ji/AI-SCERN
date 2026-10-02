// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Smart BFS Web Crawler
// Priority-based breadth-first search with content-type detection
// No headless browser — pure fetch() with stealth headers
// ════════════════════════════════════════════════════════════════════════════

import * as cheerio from 'cheerio'
import type { DiscoveredLink, CrawlOptions } from './types'
import { DEFAULT_CRAWL_OPTS } from './types'

const STEALTH_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
  'DNT': '1',
  'Cache-Control': 'max-age=0',
}

const NOISE_SELECTORS = [
  'script', 'style', 'nav', 'footer', 'header', 'aside',
  '.ads', '.advertisement', '.ad-container', '#cookie-banner', '.cookie', '.gdpr',
  '.popup', '.modal', '.newsletter', '.sidebar', '.related-posts', '.social-share',
  '[class*="cookie"]', '[id*="cookie"]', '[class*="popup"]', '[class*="overlay"]',
  '[class*="modal"]', '[class*="ad-"]', '[id*="ad-"]', 'noscript',
  '.comments', '#comments', '.comment-section', '.disqus',
  '.share-buttons', '.author-bio', '.newsletter-signup',
]

const CONTENT_SELECTORS = [
  'article', 'main', '[role="main"]', '.post-content', '.article-content', '.entry-content',
  '.post-body', '.article-body', '.story-body', '.blog-content', '.page-content',
  '[class*="article"]', '[class*="post-body"]', '[class*="entry"]', '#content', '.content', '#main',
  '.wp-block-post-content', '.entry', '.single-content', '.the-content',
]

// Priority scoring for BFS
const HIGH_PRIORITY_PATHS = /\/(blog|article|post|news|story|editorial|guide|tutorial|review)\//i
const MEDIUM_PRIORITY_PATHS = /\/(about|contact|services|products|portfolio|case-studies|whitepaper)\//i
const LOW_PRIORITY_PATHS = /\/(tag|category|author|archive|feed|sitemap|wp-json|wp-content|cdn-cgi)\//i
const SKIP_PATHS = /\.(pdf|zip|exe|dmg|mp4|mp3|avi|mov|jpg|jpeg|png|webp|gif|svg|css|js|woff|woff2|ttf)(\?.*)?$/i

function scoreLinkPriority(url: string, linkText: string): number {
  const path = new URL(url).pathname.toLowerCase()
  const text = linkText.toLowerCase()

  // High priority: content pages
  if (HIGH_PRIORITY_PATHS.test(path)) return 90
  if (/\/(blog|article|post|news)\//i.test(path)) return 85
  if (text.includes('read more') || text.includes('continue reading')) return 80

  // Medium priority: important pages
  if (MEDIUM_PRIORITY_PATHS.test(path)) return 60
  if (/about|contact|services|portfolio/i.test(text)) return 55

  // Low priority: archive/tag pages
  if (LOW_PRIORITY_PATHS.test(path)) return 20
  if (/tag|category|archive|page\/\d+/i.test(path)) return 15

  // Skip: files and assets
  if (SKIP_PATHS.test(path)) return 0

  return 40 // default
}

export interface FetchedPage {
  url: string
  html: string
  fetchMethod: 'direct' | 'jina' | 'cache'
  statusCode: number
  contentType?: string
}

async function fetchDirect(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: STEALTH_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return null
    const html = await res.text()
    return html.length > 200 ? html : null
  } catch { return null }
}

async function fetchJina(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/html',
        'X-Return-Format': 'html',
        'X-Timeout': String(Math.ceil(timeoutMs / 1000)),
        'X-No-Cache': 'true',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length < 200) return null
    // Jina wraps content — check if it's an error message
    if (text.includes('Failed to fetch') || text.includes('Could not resolve')) return null
    return text
  } catch { return null }
}

async function fetchCache(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const res = await fetch(
      `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}&hl=en`,
      { headers: { 'User-Agent': STEALTH_HEADERS['User-Agent'] }, signal: AbortSignal.timeout(timeoutMs) }
    )
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 300 ? html : null
  } catch { return null }
}

export async function fetchPage(url: string): Promise<FetchedPage | null> {
  // Module 4.3: race direct + Jina in parallel (was: sequential 3-stage
  // fallback — 12s + 25s + 10s = up to 47s for one dead URL).
  // Now: whichever responds first wins; both have independent timeouts.
  const DIRECT_TIMEOUT = 12_000
  const JINA_TIMEOUT = 15_000  // reduced from 25s — if Jina works, it works in <15s

  const winner = await Promise.race([
    fetchDirect(url, DIRECT_TIMEOUT).then(h => h ? { html: h, src: 'direct' as const } : null),
    fetchJina(url, JINA_TIMEOUT).then(h => h ? { html: h, src: 'jina' as const } : null),
  ]).catch(() => null)

  if (winner) {
    return { url, html: winner.html, fetchMethod: winner.src, statusCode: 200 }
  }

  // Last resort — Google cache (5s timeout, was 10s)
  const cached = await fetchCache(url, 5_000)
  if (cached) return { url, html: cached, fetchMethod: 'cache', statusCode: 200 }

  return null
}

export interface ParsedPage {
  url: string
  title: string
  description: string
  textContent: string
  wordCount: number
  contentType: 'article' | 'product' | 'homepage' | 'forum' | 'documentation' | 'other'
  links: DiscoveredLink[]
  imageUrls: string[]
  headings: string[]
  metaKeywords?: string
  publishDate?: string
  author?: string
  language?: string
  fetchMethod: 'direct' | 'jina' | 'cache'
  ogImage?: string
  rawHtml: string
}

export function parsePage(html: string, baseUrl: string, fetchMethod: 'direct' | 'jina' | 'cache'): ParsedPage {
  const url = new URL(baseUrl)
  const $ = cheerio.load(html)

  // Remove noise
  $(NOISE_SELECTORS.join(', ')).remove()

  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() ||
    $('meta[name="twitter:image"]').attr('content')?.trim()

  const title = $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    url.hostname

  const description = $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() || ''

  const author = $('meta[name="author"]').attr('content')?.trim() ||
    $('[rel="author"]').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim()

  const publishDate = $('meta[property="article:published_time"]').attr('content') ||
    $('time[datetime]').first().attr('datetime')

  const language = $('html').attr('lang')?.slice(0, 5)
  const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim()

  const headings: string[] = []
  $('h1,h2,h3').each((_, el) => {
    const t = $(el).text().trim()
    if (t.length > 3 && headings.length < 20) headings.push(t)
  })

  // Extract main content
  let $main = $('')
  for (const sel of CONTENT_SELECTORS) {
    if ($(sel).length) { $main = $(sel).first(); break }
  }
  const $cont = $main.length ? $main : $('body')

  const blocks: string[] = []
  $cont.find('p,h1,h2,h3,h4,blockquote,li,td').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim()
    if (t.length > 30 && blocks.length < 150) blocks.push(t.slice(0, 1500))
  })
  const textContent = blocks.join('\n\n')
  const wordCount = textContent.split(/\s+/).filter(Boolean).length

  // Content type detection
  const full = (html + url.href).toLowerCase()
  const isArticle = /article|blog|post|news|story|editorial/i.test(full) ||
    /\/(blog|news|article|post|story)\//i.test(url.pathname)
  const isProduct = /product|shop|buy|price|cart|checkout/i.test(full)
  const isForum = /forum|discuss|reply|thread|reddit|quora/i.test(url.hostname + url.pathname)
  const isDocs = /docs|documentation|api.?ref|reference|guide|manual/i.test(url.pathname)
  const contentType = isArticle ? 'article' : isProduct ? 'product' : isForum ? 'forum' : isDocs ? 'documentation' : url.pathname === '/' ? 'homepage' : 'other'

  // Extract links
  const links: DiscoveredLink[] = []
  $('a[href]').each((_, el) => {
    if (links.length >= 80) return
    try {
      let href = $(el).attr('href')?.trim() || ''
      if (href.startsWith('//')) href = `https:${href}`
      else if (href.startsWith('/')) href = `${url.origin}${href}`
      else if (!href.startsWith('http')) return

      const lu = new URL(href)
      const lt = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120)
      if (lu.protocol.startsWith('http') && lt.length > 1 && !href.includes('#')) {
        const isInternal = lu.hostname === url.hostname
        const priority = scoreLinkPriority(href, lt)
        if (priority > 0) {
          links.push({ url: lu.href, text: lt, isInternal, priority })
        }
      }
    } catch {}
  })

  // Extract image URLs — gather from every lazy-load pattern sites use, not
  // just plain src, so a real photo doesn't get skipped just because a site
  // lazy-loads via srcset/data-original/noscript.
  const imageUrls: string[] = []
  const MAX_IMAGES_PER_PAGE = 40

  function resolve(src: string): string | null {
    src = src.trim()
    if (!src) return null
    if (src.startsWith('//')) src = `https:${src}`
    else if (src.startsWith('/')) src = `${url.origin}${src}`
    if (!src.startsWith('http')) return null
    if (src.includes('tracking') || src.includes('pixel') || src.length >= 600) return null
    return src
  }

  function bestFromSrcset(srcset: string): string | null {
    // "url1 320w, url2 640w, url3 1024w" — take the highest-width candidate
    const candidates = srcset.split(',').map(part => {
      const [u, descriptor] = part.trim().split(/\s+/)
      const width = descriptor && descriptor.endsWith('w') ? parseInt(descriptor) : 0
      return { u, width: Number.isFinite(width) ? width : 0 }
    }).filter(c => c.u)
    if (!candidates.length) return null
    candidates.sort((a, b) => b.width - a.width)
    return candidates[0].u
  }

  $('img,source').each((_, el) => {
    if (imageUrls.length >= MAX_IMAGES_PER_PAGE) return
    try {
      const $el = $(el)
      const srcset = $el.attr('srcset') || $el.attr('data-srcset')
      let src = $el.attr('src') || $el.attr('data-src') || $el.attr('data-lazy-src') ||
                $el.attr('data-original') || $el.attr('data-original-src') || ''
      if (srcset) { const best = bestFromSrcset(srcset); if (best) src = best }
      const resolved = resolve(src)
      if (resolved) imageUrls.push(resolved)
    } catch {}
  })

  // Real images are sometimes only present in the <noscript> fallback of a
  // lazy-loading <img>, invisible to the selectors above.
  $('noscript').each((_, el) => {
    if (imageUrls.length >= MAX_IMAGES_PER_PAGE) return
    try {
      const inner = cheerio.load($(el).html() || '')
      inner('img[src]').each((__, imgEl) => {
        if (imageUrls.length >= MAX_IMAGES_PER_PAGE) return
        const resolved = resolve(inner(imgEl).attr('src') || '')
        if (resolved) imageUrls.push(resolved)
      })
    } catch {}
  })

  // Also check for background images in style attributes
  $('[style*="background"]').each((_, el) => {
    if (imageUrls.length >= MAX_IMAGES_PER_PAGE) return
    const style = $(el).attr('style') || ''
    const match = style.match(/url\(["']?([^"')]+)["']?\)/)
    if (match?.[1]) {
      const resolved = resolve(match[1].startsWith('/') ? `${url.origin}${match[1]}` : match[1])
      if (resolved) imageUrls.push(resolved)
    }
  })

  return {
    url: baseUrl,
    title,
    description,
    textContent,
    wordCount,
    contentType,
    links,
    imageUrls: [...new Set(imageUrls)].slice(0, MAX_IMAGES_PER_PAGE),
    headings,
    metaKeywords,
    publishDate,
    author,
    language,
    fetchMethod,
    ogImage,
    rawHtml: html,
  }
}

export interface CrawlResult {
  pages: ParsedPage[]
  allImages: { url: string; sourcePage: string }[]
  allLinks: DiscoveredLink[]
  failedUrls: string[]
  fetchStats: { direct: number; jina: number; cache: number; failed: number }
  isWordPress: boolean
  wordPressVersion?: string
  discoveryMethod: 'sitemap' | 'crawl' | 'hybrid'
}

/**
 * Fetch and parse /sitemap.xml (and, if present, up to 3 sub-sitemaps from a
 * sitemap index) to discover pages up front instead of relying purely on
 * BFS link-following, which misses pages with no inbound internal links
 * (common for e-commerce/blog archives). Best-effort: any failure returns
 * an empty list and the BFS crawl proceeds exactly as before.
 */
async function discoverFromSitemap(origin: string, maxUrls: number): Promise<string[]> {
  const discovered: string[] = []

  async function fetchXml(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AiscernBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return null
      return await res.text()
    } catch { return null }
  }

  const rootXml = await fetchXml(`${origin}/sitemap.xml`)
  if (!rootXml) return discovered

  // Sitemap index (points to other sitemaps) vs a plain urlset
  const isIndex = /<sitemapindex/i.test(rootXml)
  const locMatches = [...rootXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1])

  if (isIndex) {
    // Fetch up to 3 sub-sitemaps (avoid unbounded fan-out on huge sites)
    for (const sitemapUrl of locMatches.slice(0, 3)) {
      const subXml = await fetchXml(sitemapUrl)
      if (!subXml) continue
      const subLocs = [...subXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1])
      discovered.push(...subLocs)
      if (discovered.length >= maxUrls) break
    }
  } else {
    discovered.push(...locMatches)
  }

  return discovered.slice(0, maxUrls)
}

// Fetches /robots.txt and returns the Disallow paths that apply to '*' (and,
// if present, to our own AiscernBot UA — a more specific block always wins
// over the wildcard block for that same path prefix). Module 2 gap fix:
// CrawlOptions.respectRobots existed and defaulted to true but nothing in
// crawlSite() ever read it — every crawl ignored robots.txt entirely.
// Module 4.5: Redis cache 1h TTL (was: fresh fetch every scan — 0.5-2s wasted).
async function fetchRobotsDisallowed(origin: string): Promise<string[]> {
  // Module 4.5: check Redis cache first
  const cacheKey = `robots:${origin}`
  try {
    const { getRedis } = await import('@/lib/cache/redis')
    const redis = getRedis()
    if (redis) {
      const cached = await redis.get<string>(cacheKey)
      if (cached !== null) {
        try {
          return JSON.parse(cached)
        } catch { /* corrupt cache — fall through to fresh fetch */ }
      }
    }
  } catch { /* Redis down — fall through to fresh fetch */ }

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AiscernBot/1.0)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const text = await res.text()

    const disallowed: string[] = []
    let currentGroupApplies = false
    for (const rawLine of text.split('\n')) {
      const line = rawLine.split('#')[0].trim()
      if (!line) continue
      const [rawKey, ...rest] = line.split(':')
      const key = rawKey.trim().toLowerCase()
      const value = rest.join(':').trim()

      if (key === 'user-agent') {
        currentGroupApplies = value === '*' || /aiscern/i.test(value)
      } else if (key === 'disallow' && currentGroupApplies && value) {
        disallowed.push(value)
      }
    }
    // Module 4.5: cache the result in Redis (1h TTL)
    try {
      const { getRedis } = await import('@/lib/cache/redis')
      const redis = getRedis()
      if (redis) {
        await redis.setex(cacheKey, 3600, JSON.stringify(disallowed))
      }
    } catch { /* Redis down — non-fatal */ }
    return disallowed
  } catch {
    return [] // fail open — an unreachable robots.txt shouldn't block a scan
  }
}

function isDisallowedByRobots(pathname: string, disallowedPaths: string[]): boolean {
  return disallowedPaths.some(rule => pathname.startsWith(rule))
}

export async function crawlSite(
  startUrl: string,
  options: typeof DEFAULT_CRAWL_OPTS = DEFAULT_CRAWL_OPTS
): Promise<CrawlResult> {
  const opts = { ...DEFAULT_CRAWL_OPTS, ...options }
  const origin = new URL(startUrl).origin
  const domain = new URL(startUrl).hostname

  const visited = new Set<string>()
  const pages: ParsedPage[] = []
  const allImages: { url: string; sourcePage: string }[] = []
  const failedUrls: string[] = []
  const fetchStats = { direct: 0, jina: 0, cache: 0, failed: 0 }
  let isWordPress = false
  let wordPressVersion: string | undefined
  let discoveryMethod: 'sitemap' | 'crawl' | 'hybrid' = 'crawl'

  // Priority queue: higher priority = scan first
  // Module 4.4: was `queue.some(q => q.url === url)` — O(n) per link. Now:
  // use a Set `queuedUrls` for O(1) lookup. The queue array is still sorted
  // by priority on dequeue (TODO: replace with binary heap in future pass —
  // the Set fix eliminates the O(n²) bottleneck, sort is O(n log n) per item).
  const queue: { url: string; depth: number; priority: number }[] = [
    { url: startUrl, depth: 0, priority: 100 }
  ]
  const queuedUrls = new Set<string>([startUrl])

  // robots.txt (Module 2 gap fix — see fetchRobotsDisallowed above)
  const disallowedPaths = opts.respectRobots !== false
    ? await fetchRobotsDisallowed(origin)
    : []

  // Seed additional URLs from sitemap.xml when available
  const sitemapUrls = await discoverFromSitemap(origin, opts.maxPages! * 2)
  if (sitemapUrls.length > 0) {
    discoveryMethod = 'hybrid'
    for (const url of sitemapUrls) {
      if (queuedUrls.has(url)) continue  // Module 4.4: O(1) Set lookup
      try {
        const u = new URL(url)
        if (u.hostname !== domain) continue
        if (isDisallowedByRobots(u.pathname, disallowedPaths)) continue
      } catch { continue }
      queue.push({ url, depth: 1, priority: 90 })
      queuedUrls.add(url)
    }
  }

  // Module 4.2: bounded-concurrency worker pool (was: sequential while loop).
  // Was: `await fetchPage(current.url)` in a while loop — 30 pages × 2s = 60s.
  // Now: CONCURRENCY workers fetch in parallel. 4 workers for ≤100 pages,
  // 8 workers for >100 pages (Deep/Pro-Deep scans).
  const CONCURRENCY = (opts.maxPages ?? 30) > 100 ? 8 : 4
  let activeWorkers = 0

  await new Promise<void>((resolve) => {
    const worker = async () => {
      while (queue.length > 0 && pages.length < opts.maxPages!) {
        // Priority dequeue — sort and shift (Module 4.4: O(n log n) per item,
        // acceptable for ≤500 pages; binary heap would be O(log n) but adds a dep)
        queue.sort((a, b) => b.priority - a.priority)
        const current = queue.shift()!
        queuedUrls.delete(current.url)

        if (visited.has(current.url)) continue
        visited.add(current.url)

        activeWorkers++
        try {
          const fetched = await fetchPage(current.url)
          if (!fetched) {
            failedUrls.push(current.url)
            fetchStats.failed++
            continue
          }

          fetchStats[fetched.fetchMethod]++

          const parsed = parsePage(fetched.html, current.url, fetched.fetchMethod)
          pages.push(parsed)

          // Collect images
          for (const imgUrl of parsed.imageUrls) {
            allImages.push({ url: imgUrl, sourcePage: current.url })
          }

          // WordPress detection
          if (!isWordPress) {
            const wpCheck = detectWordPress(fetched.html, current.url)
            isWordPress = wpCheck.isWordPress
            wordPressVersion = wpCheck.version
          }

          // Add internal links to queue (Module 4.4: Set lookup instead of queue.some)
          if (current.depth < opts.maxDepth!) {
            const internalLinks = parsed.links
              .filter(l => l.isInternal && !visited.has(l.url))
              .filter(l => {
                const path = new URL(l.url).pathname.toLowerCase()
                return !SKIP_PATHS.test(path) &&
                  !/\/(wp-admin|wp-login|wp-json|wp-content\/uploads\/\d{4}\/\d{2})\//i.test(path) &&
                  !isDisallowedByRobots(path, disallowedPaths)
              })

            for (const link of internalLinks) {
              if (!queuedUrls.has(link.url)) {  // Module 4.4: O(1) Set lookup
                queue.push({ url: link.url, depth: current.depth + 1, priority: link.priority })
                queuedUrls.add(link.url)
              }
            }
          }
        } catch (e) {
          console.warn(`[crawl] failed ${current.url}:`, e)
          failedUrls.push(current.url)
        } finally {
          activeWorkers--
          if (queue.length === 0 && activeWorkers === 0) resolve()
        }
      }
      if (queue.length === 0 && activeWorkers === 0) resolve()
    }
    // Spawn workers
    for (let i = 0; i < CONCURRENCY; i++) {
      worker()
    }
    if (queue.length === 0) resolve()
  })

  return {
    pages,
    allImages: allImages.slice(0, opts.maxImagesTotal! * 2),
    allLinks: [...new Set(pages.flatMap(p => p.links))],
    failedUrls,
    fetchStats,
    isWordPress,
    wordPressVersion,
    discoveryMethod,
  }
}

function detectWordPress(html: string, url: string): { isWordPress: boolean; version?: string } {
  const checks = [
    /wp-content/i.test(html),
    /wp-includes/i.test(html),
    /<meta name="generator" content="WordPress/i.test(html),
    /\/wp-json\//i.test(url),
    /xmlrpc\.php/i.test(html),
    /wp-block/i.test(html),
    /wp-embed/i.test(html),
  ]
  const score = checks.filter(Boolean).length

  let version: string | undefined
  const vMatch = html.match(/<meta name="generator" content="WordPress (\d+\.\d+[^"]*)/i)
  if (vMatch) version = vMatch[1]

  return { isWordPress: score >= 2, version }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // Remove trailing slash, query params, fragments for dedup
    return `${u.origin}${u.pathname.replace(/\/$/, '')}`.toLowerCase()
  } catch { return url.toLowerCase() }
}

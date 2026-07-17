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

async function fetchJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/html',
        'X-Return-Format': 'html',
        'X-Timeout': '20',
        'X-No-Cache': 'true',
      },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (text.length < 200) return null
    // Jina wraps content — check if it's an error message
    if (text.includes('Failed to fetch') || text.includes('Could not resolve')) return null
    return text
  } catch { return null }
}

async function fetchCache(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}&hl=en`,
      { headers: { 'User-Agent': STEALTH_HEADERS['User-Agent'] }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 300 ? html : null
  } catch { return null }
}

export async function fetchPage(url: string): Promise<FetchedPage | null> {
  // Try direct first
  const direct = await fetchDirect(url)
  if (direct) return { url, html: direct, fetchMethod: 'direct', statusCode: 200 }

  // Try Jina as fallback
  const jina = await fetchJina(url)
  if (jina) return { url, html: jina, fetchMethod: 'jina', statusCode: 200 }

  // Last resort: Google cache
  const cached = await fetchCache(url)
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

  // Extract image URLs
  const imageUrls: string[] = []
  $('img[src],img[data-src],img[data-lazy-src],source[srcset]').each((_, el) => {
    if (imageUrls.length >= 20) return
    try {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
      if (src.startsWith('//')) src = `https:${src}`
      else if (src.startsWith('/')) src = `${url.origin}${src}`
      if (src.startsWith('http') && !src.includes('tracking') && !src.includes('pixel') && src.length < 600) {
        imageUrls.push(src)
      }
    } catch {}
  })

  // Also check for background images in style attributes
  $('[style*="background"]').each((_, el) => {
    if (imageUrls.length >= 20) return
    const style = $(el).attr('style') || ''
    const match = style.match(/url\(["']?([^"')]+)["']?\)/)
    if (match?.[1]) {
      let src = match[1]
      if (src.startsWith('/')) src = `${url.origin}${src}`
      if (src.startsWith('http') && src.length < 600) imageUrls.push(src)
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
    imageUrls: [...new Set(imageUrls)].slice(0, 20),
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

  // Priority queue: higher priority = scan first
  const queue: { url: string; depth: number; priority: number }[] = [
    { url: startUrl, depth: 0, priority: 100 }
  ]

  while (queue.length > 0 && pages.length < opts.maxPages!) {
    // Sort by priority (descending)
    queue.sort((a, b) => b.priority - a.priority)
    const current = queue.shift()!

    if (visited.has(current.url)) continue
    visited.add(current.url)

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

    // Add internal links to queue
    if (current.depth < opts.maxDepth!) {
      const internalLinks = parsed.links
        .filter(l => l.isInternal && !visited.has(l.url))
        .filter(l => {
          // Skip common non-content paths
          const path = new URL(l.url).pathname.toLowerCase()
          return !SKIP_PATHS.test(path) &&
            !/\/(wp-admin|wp-login|wp-json|wp-content\/uploads\/\d{4}\/\d{2})\//i.test(path)
        })

      for (const link of internalLinks) {
        if (!queue.some(q => q.url === link.url)) {
          queue.push({ url: link.url, depth: current.depth + 1, priority: link.priority })
        }
      }
    }
  }

  return {
    pages,
    allImages: allImages.slice(0, opts.maxImagesTotal! * 2),
    allLinks: [...new Set(pages.flatMap(p => p.links))],
    failedUrls,
    fetchStats,
    isWordPress,
    wordPressVersion,
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

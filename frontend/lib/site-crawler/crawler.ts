// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Site Crawler
// Lightweight, dependency-free (no headless browser) same-domain crawler.
// Free-tier friendly: plain fetch() calls only, so it runs fine on Vercel's
// Edge/Node runtime or a Cloudflare Worker (Workers Unbound / Cron Triggers)
// without needing Puppeteer/Playwright.
//
// Discovery order (cheapest + most reliable first):
//   1. sitemap.xml / sitemap_index.xml   (fast, structured, no parsing HTML)
//   2. robots.txt "Sitemap:" directives  (some sites hide sitemap location)
//   3. BFS same-domain <a href> crawl    (fallback for sites with no sitemap)
//
// Respects robots.txt Disallow rules for the "*" and "AiscernBot" user agents.
// ════════════════════════════════════════════════════════════════════════════

export interface CrawledPage {
  url:          string
  html:         string
  imageUrls:    string[]
  linkedUrls:   string[]
  isWordPress:  boolean
  fetchedOk:    boolean
}

export interface CrawlOptions {
  maxPages?:     number   // hard cap on pages fetched (cost control)
  maxDepth?:     number   // BFS depth cap when falling back to link-crawling
  concurrency?:  number   // parallel fetches
  timeoutMs?:    number
  userAgent?:    string
}

const DEFAULTS: Required<CrawlOptions> = {
  maxPages:    25,
  maxDepth:    3,
  concurrency: 5,
  timeoutMs:   10_000,
  userAgent:   'AiscernBot/1.0 (+https://aiscern.com/bot; AI-content-detection)',
}

// ── robots.txt ──────────────────────────────────────────────────────────────

interface RobotsRules { disallow: string[]; sitemaps: string[] }

async function fetchRobots(origin: string, ua: string, timeoutMs: number): Promise<RobotsRules> {
  const rules: RobotsRules = { disallow: [], sitemaps: [] }
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': ua } })
    if (!res.ok) return rules
    const text = await res.text()
    let relevant = false
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (/^user-agent:/i.test(line)) {
        const agent = line.split(':')[1]?.trim().toLowerCase()
        relevant = agent === '*' || agent === 'aiscernbot'
        continue
      }
      if (/^sitemap:/i.test(line)) {
        const sm = line.substring(line.indexOf(':') + 1).trim()
        if (sm) rules.sitemaps.push(sm)
        continue
      }
      if (relevant && /^disallow:/i.test(line)) {
        const path = line.split(':')[1]?.trim()
        if (path) rules.disallow.push(path)
      }
    }
  } catch { /* robots.txt absent → allow everything */ }
  return rules
}

function isAllowed(pathname: string, disallow: string[]): boolean {
  return !disallow.some(rule => rule !== '' && pathname.startsWith(rule))
}

// ── sitemap.xml ─────────────────────────────────────────────────────────────

async function fetchSitemapUrls(sitemapUrl: string, ua: string, timeoutMs: number, depth = 0): Promise<string[]> {
  if (depth > 2) return [] // avoid sitemap-index recursion bombs
  try {
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': ua } })
    if (!res.ok) return []
    const xml = await res.text()

    // Sitemap index → recurse into child sitemaps (max 5 to bound cost)
    const childSitemaps = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/gi)].map(m => m[1])
    if (childSitemaps.length > 0) {
      const results: string[] = []
      for (const child of childSitemaps.slice(0, 5)) {
        results.push(...await fetchSitemapUrls(child, ua, timeoutMs, depth + 1))
      }
      return results
    }

    // Regular urlset
    return [...xml.matchAll(/<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/url>/gi)].map(m => m[1].trim())
  } catch { return [] }
}

// ── WordPress fingerprinting ────────────────────────────────────────────────
// Multiple independent signals so a single false positive (e.g. a generic
// "generator" meta someone copied) doesn't misclassify the CMS.

export function detectWordPress(html: string): boolean {
  const signals = [
    /wp-content\//i,
    /wp-includes\//i,
    /name="generator"\s+content="WordPress/i,
    /\/wp-json\//i,
    /class="[^"]*\bwp-block-/i,
  ]
  const hits = signals.filter(rx => rx.test(html)).length
  return hits >= 1
}

// ── HTML link + image extraction ────────────────────────────────────────────

function extractLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin
  const urls = new Set<string>()
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    try {
      const abs = new URL(m[1], baseUrl)
      if (abs.origin !== origin) continue
      if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|mp4|mp3|css|js)$/i.test(abs.pathname)) continue
      abs.hash = ''
      urls.add(abs.toString())
    } catch { /* skip malformed */ }
  }
  return [...urls]
}

function extractImages(html: string): string[] {
  const urls = new Set<string>()
  for (const m of html.matchAll(/<img\s[^>]*src=["']([^"']+)["']/gi)) {
    const src = m[1]
    if (/^https?:\/\//i.test(src) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src)) {
      if (!/icon|logo|pixel|1x1|avatar|emoji|sprite/i.test(src)) urls.add(src)
    }
  }
  // WordPress-specific: wp-content/uploads is where post/media images live —
  // prioritise these since they're the actual content images (not theme chrome).
  return [...urls].sort((a, b) => {
    const aw = /wp-content\/uploads/i.test(a) ? 0 : 1
    const bw = /wp-content\/uploads/i.test(b) ? 0 : 1
    return aw - bw
  })
}

// ── Single page fetch ────────────────────────────────────────────────────────

async function fetchPage(url: string, ua: string, timeoutMs: number): Promise<CrawledPage> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': ua, 'Accept': 'text/html' },
    })
    if (!res.ok) return { url, html: '', imageUrls: [], linkedUrls: [], isWordPress: false, fetchedOk: false }
    const html = await res.text()
    return {
      url,
      html,
      imageUrls:   extractImages(html),
      linkedUrls:  extractLinks(html, url),
      isWordPress: detectWordPress(html),
      fetchedOk:   true,
    }
  } catch {
    return { url, html: '', imageUrls: [], linkedUrls: [], isWordPress: false, fetchedOk: false }
  }
}

// ── Concurrency-limited map ─────────────────────────────────────────────────

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(new Array(Math.min(limit, items.length)).fill(0).map(worker))
  return results
}

// ── Public API: crawl a site ────────────────────────────────────────────────

export interface SiteCrawlResult {
  pages:       CrawledPage[]
  origin:      string
  isWordPress: boolean   // true if ANY page fingerprinted as WordPress
  discoveryMethod: 'sitemap' | 'link-crawl'
}

export async function crawlSite(startUrl: string, options: CrawlOptions = {}): Promise<SiteCrawlResult> {
  const opts   = { ...DEFAULTS, ...options }
  const origin = new URL(startUrl).origin

  const robots = await fetchRobots(origin, opts.userAgent, opts.timeoutMs)

  // 1. Try sitemap-based discovery first (cheap, structured, complete)
  let discoveryMethod: 'sitemap' | 'link-crawl' = 'sitemap'
  const sitemapCandidates = robots.sitemaps.length > 0
    ? robots.sitemaps
    : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]

  let urls: string[] = []
  for (const sm of sitemapCandidates) {
    urls = await fetchSitemapUrls(sm, opts.userAgent, opts.timeoutMs)
    if (urls.length > 0) break
  }
  urls = urls.filter(u => { try { return new URL(u).origin === origin && isAllowed(new URL(u).pathname, robots.disallow) } catch { return false } })

  // 2. Fallback: BFS link crawl from the start URL
  if (urls.length === 0) {
    discoveryMethod = 'link-crawl'
    const visited = new Set<string>()
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }]
    const collected: string[] = []

    while (queue.length > 0 && collected.length < opts.maxPages) {
      const batch = queue.splice(0, opts.concurrency)
      const pages = await mapLimit(batch, opts.concurrency, b => fetchPage(b.url, opts.userAgent, opts.timeoutMs))
      for (let idx = 0; idx < batch.length; idx++) {
        const { url, depth } = batch[idx]
        if (visited.has(url)) continue
        visited.add(url)
        const page = pages[idx]
        if (page.fetchedOk) collected.push(url)
        if (depth < opts.maxDepth) {
          for (const link of page.linkedUrls) {
            if (!visited.has(link) && isAllowed(new URL(link).pathname, robots.disallow)) {
              queue.push({ url: link, depth: depth + 1 })
            }
          }
        }
      }
    }
    urls = collected
  }

  urls = urls.slice(0, opts.maxPages)
  if (urls.length === 0) urls = [startUrl] // always analyze at least the entry URL

  const pages = await mapLimit(urls, opts.concurrency, u => fetchPage(u, opts.userAgent, opts.timeoutMs))
  const fetchedPages = pages.filter(p => p.fetchedOk)

  return {
    pages:       fetchedPages.length > 0 ? fetchedPages : pages,
    origin,
    isWordPress: pages.some(p => p.isWordPress),
    discoveryMethod,
  }
}

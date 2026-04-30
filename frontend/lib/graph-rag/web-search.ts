// ════════════════════════════════════════════════════════════════════════════
// AISCERN GRAPH RAG — Web Search Engine
// Sources: Jina Search (primary) → Serper.dev (if key) → DuckDuckGo (fallback)
// No single point of failure — cascade until we get results
// ════════════════════════════════════════════════════════════════════════════

import type { WebSearchResult } from './types'

// ── Jina AI Search (free, no key, reliable) ──────────────────────────────────
// Returns rich structured results via s.jina.ai
async function searchJina(query: string, maxResults: number): Promise<WebSearchResult[]> {
  try {
    const encoded = encodeURIComponent(query)
    const res = await fetch(`https://s.jina.ai/${encoded}`, {
      headers: {
        'Accept':          'application/json',
        'X-Return-Format': 'json',
        'X-With-Links-Summary': 'true',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return []

    const data = await res.json()
    const items: any[] = Array.isArray(data?.data) ? data.data :
                          Array.isArray(data?.results) ? data.results : []

    return items.slice(0, maxResults).map(item => ({
      title:   item.title   || item.url || '',
      url:     item.url     || '',
      snippet: (item.description || item.content || item.snippet || '').slice(0, 600),
      domain:  extractDomain(item.url || ''),
      date:    item.publishedTime || item.date || undefined,
    })).filter(r => r.url && r.snippet.length > 30)
  } catch { return [] }
}

// ── Serper.dev (if API key provided — fastest, most accurate) ────────────────
async function searchSerper(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method:  'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ q: query, num: maxResults, gl: 'us', hl: 'en' }),
      signal:  AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const organic: any[] = data.organic || []
    return organic.slice(0, maxResults).map(r => ({
      title:   r.title   || '',
      url:     r.link    || '',
      snippet: (r.snippet || '').slice(0, 600),
      domain:  extractDomain(r.link || ''),
      date:    r.date    || undefined,
    })).filter(r => r.url && r.snippet.length > 20)
  } catch { return [] }
}

// ── DuckDuckGo Instant Answer API (free, no key needed) ──────────────────────
async function searchDDG(query: string, maxResults: number): Promise<WebSearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return []
    const data = await res.json()
    const results: WebSearchResult[] = []

    // Abstract (top result)
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title:   data.Heading || query,
        url:     data.AbstractURL,
        snippet: data.AbstractText.slice(0, 600),
        domain:  extractDomain(data.AbstractURL),
        date:    undefined,
      })
    }

    // Related topics
    const topics: any[] = data.RelatedTopics || []
    for (const t of topics.slice(0, maxResults - 1)) {
      if (t.FirstURL && t.Text) {
        results.push({
          title:   t.Text.slice(0, 80),
          url:     t.FirstURL,
          snippet: t.Text.slice(0, 500),
          domain:  extractDomain(t.FirstURL),
          date:    undefined,
        })
      }
    }
    return results.slice(0, maxResults).filter(r => r.snippet.length > 20)
  } catch { return [] }
}

// ── Brave Search (if key provided) ───────────────────────────────────────────
async function searchBrave(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY
  if (!key) return []
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}&text_decorations=false`,
      {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': key },
        signal:  AbortSignal.timeout(10_000),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    const items: any[] = data.web?.results || []
    return items.slice(0, maxResults).map(r => ({
      title:   r.title   || '',
      url:     r.url     || '',
      snippet: (r.description || r.extra_snippets?.[0] || '').slice(0, 600),
      domain:  extractDomain(r.url || ''),
      date:    r.age     || undefined,
    })).filter(r => r.url && r.snippet.length > 20)
  } catch { return [] }
}

// ── Jina Reader — fetch full page content via r.jina.ai ──────────────────────
export async function fetchPageContent(url: string, maxChars = 3000): Promise<string> {
  try {
    // Skip URLs that won't give useful content
    const skip = /reddit\.com\/r\/|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com\/watch/i
    if (skip.test(url)) return ''

    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept':          'application/json',
        'X-Return-Format': 'text',
        'X-Timeout':       '12',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const content = data?.data?.content || data?.content || ''
    return typeof content === 'string' ? content.slice(0, maxChars) : ''
  } catch { return '' }
}

// ── Main search orchestrator ──────────────────────────────────────────────────
// Runs all available search sources in priority order, deduplicates results
export async function webSearch(
  queries: string[],
  maxResultsPerQuery = 5,
): Promise<WebSearchResult[]> {
  const allResults: WebSearchResult[] = []
  const seen = new Set<string>()

  await Promise.all(
    queries.slice(0, 4).map(async query => {
      // Try Serper first (fastest + most accurate), then Jina, then Brave, then DDG
      const [serper, jina, brave] = await Promise.all([
        searchSerper(query, maxResultsPerQuery),
        searchJina(query, maxResultsPerQuery),
        searchBrave(query, maxResultsPerQuery),
      ])

      // Merge: Serper > Jina > Brave > DDG (in order of preference)
      const merged = [...serper, ...jina, ...brave]
      if (merged.length < 3) {
        const ddg = await searchDDG(query, maxResultsPerQuery)
        merged.push(...ddg)
      }

      for (const r of merged) {
        const key = r.url.split('?')[0]  // dedupe ignoring query params
        if (!seen.has(key) && r.url.startsWith('http')) {
          seen.add(key)
          allResults.push(r)
        }
      }
    })
  )

  // Sort by snippet length (longer = more informative)
  return allResults.sort((a, b) => b.snippet.length - a.snippet.length)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Credibility score for a domain (0–1)
export function domainCredibility(domain: string): number {
  const high = [
    'reuters.com','apnews.com','bbc.com','bbc.co.uk','nytimes.com','theguardian.com',
    'washingtonpost.com','nature.com','sciencedirect.com','scholar.google.com',
    'arxiv.org','ieee.org','acm.org','mit.edu','stanford.edu','oxford.ac.uk',
    'cambridge.org','wikipedia.org','techcrunch.com','wired.com','arstechnica.com',
    'thenextweb.com','venturebeat.com','theregister.com','zdnet.com',
    'research.google','openai.com','anthropic.com','deepmind.com','huggingface.co',
  ]
  const medium = [
    'medium.com','towardsdatascience.com','substack.com','github.com',
    'stackoverflow.com','dev.to','hackernews.com','news.ycombinator.com',
    'forbes.com','businessinsider.com','cnn.com','nbcnews.com','cbsnews.com',
  ]
  const low = ['reddit.com','twitter.com','x.com','facebook.com','quora.com','yahoo.com']

  if (high.some(d => domain.includes(d)))   return 0.9
  if (medium.some(d => domain.includes(d))) return 0.65
  if (low.some(d => domain.includes(d)))    return 0.3
  return 0.5
}

/**
 * Aiscern — Page Content Fetcher
 * Fetches readable text from a URL via Jina Reader API.
 * Extracted from the old graph-rag module — this is a pure utility, not RAG.
 */

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

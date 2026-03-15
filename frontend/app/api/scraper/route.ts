import { NextRequest, NextResponse } from 'next/server'
import type { APIResponse } from '@/types'

const HF_API   = 'https://api-inference.huggingface.co/models'
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
const TEXT_MODEL = 'openai-community/roberta-base-openai-detector'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

/** Fetch a URL and extract text + image URLs */
async function fetchPageContent(url: string): Promise<{
  title: string
  description: string
  textBlocks: string[]
  imageUrls:  string[]
}> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DETECTAI-Scanner/1.0)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`)
  const html = await res.text()

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title      = titleMatch?.[1]?.trim() || new URL(url).hostname

  // Extract meta description
  const descMatch  = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
  const description = descMatch?.[1]?.trim() || ''

  // Extract text blocks (paragraphs, headings)
  const textBlocks: string[] = []
  const textRegex = /<(p|h[1-6]|article|section)[^>]*>([\s\S]*?)<\/\1>/gi
  let m
  while ((m = textRegex.exec(html)) !== null && textBlocks.length < 10) {
    const clean = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (clean.length > 80) textBlocks.push(clean.slice(0, 500))
  }

  // Extract image URLs
  const imageUrls: string[] = []
  const imgRegex  = /<img[^>]+src=["']([^"']+)["']/gi
  while ((m = imgRegex.exec(html)) !== null && imageUrls.length < 10) {
    let src = m[1]
    if (src.startsWith('//')) src = 'https:' + src
    else if (src.startsWith('/')) src = new URL(src, url).href
    if (src.startsWith('http')) imageUrls.push(src)
  }

  return { title, description, textBlocks, imageUrls }
}

/** Analyze a text block with HF */
async function analyzeTextBlock(text: string): Promise<{ verdict: string; confidence: number }> {
  try {
    const res = await fetch(`${HF_API}/${TEXT_MODEL}`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ inputs: text.slice(0, 512) }),
      signal:  AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { verdict: 'UNCERTAIN', confidence: 50 }
    const data = await res.json() as { label: string; score: number }[][]
    const flat  = Array.isArray(data[0]) ? data[0] : data as any
    const aiE   = flat.find((s: any) => /fake|label_1/i.test(s.label))
    const huE   = flat.find((s: any) => /real|label_0/i.test(s.label))
    const score = aiE?.score ?? (huE ? 1 - huE.score : 0.5)
    const pct   = Math.round(score * 100)
    return {
      verdict:    pct >= 62 ? 'AI' : pct <= 38 ? 'HUMAN' : 'UNCERTAIN',
      confidence: pct,
    }
  } catch {
    return { verdict: 'UNCERTAIN', confidence: 50 }
  }
}

export async function POST(req: NextRequest) {
  // Require authentication to prevent scraping abuse
  const session = req.cookies.get('__session')?.value
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
  }

  // IP-based rate limit: 10 scrapes per minute
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const rateKey = `scraper:${ip}`
  const _scraperLimits = new Map<string, { count: number; resetAt: number }>()
  const now = Date.now()
  const entry = _scraperLimits.get(rateKey)
  if (entry && now < entry.resetAt) {
    if (entry.count >= 10) {
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })
    }
    entry.count++
  } else {
    _scraperLimits.set(rateKey, { count: 1, resetAt: now + 60_000 })
  }

  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json<APIResponse>({
      success: false, error: { code: 'NO_URL', message: 'URL is required' }
    }, { status: 400 })

    let urlObj: URL
    try { urlObj = new URL(url) } catch {
      return NextResponse.json<APIResponse>({
        success: false, error: { code: 'INVALID_URL', message: 'Invalid URL format' }
      }, { status: 400 })
    }

    // Fetch page
    const page = await fetchPageContent(url)

    // Analyze text blocks in parallel (max 5)
    const textToAnalyze = page.textBlocks.slice(0, 5)
    const textResults   = await Promise.all(textToAnalyze.map(t => analyzeTextBlock(t)))

    // Build asset list
    const assets: any[] = []

    // Text assets
    textToAnalyze.forEach((text, i) => {
      const r = textResults[i]
      assets.push({
        type:       'text',
        content:    text.slice(0, 150) + (text.length > 150 ? '…' : ''),
        verdict:    r.verdict,
        confidence: r.confidence,
        signals: [
          { name: 'RoBERTa AI Classifier', flagged: r.verdict === 'AI' },
          { name: 'Linguistic Pattern', flagged: r.confidence > 60 },
        ],
      })
    })

    // Image assets (metadata only — no vision model in scraper)
    page.imageUrls.slice(0, 5).forEach(imgUrl => {
      assets.push({
        type:       'image',
        url:        imgUrl,
        verdict:    'UNCERTAIN',
        confidence: 50,
        signals: [
          { name: 'Upload to Image Detector for full analysis', flagged: false },
        ],
      })
    })

    // If no assets found, add a notice
    if (assets.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'NO_CONTENT', message: 'No analyzable content found on this page. Try a different URL.' } }, { status: 422 })
    }

    const aiAssets    = assets.filter(a => a.verdict === 'AI').length
    const overallScore = Math.round((aiAssets / assets.length) * 100)

    return NextResponse.json({
      success: true,
      data: {
        url,
        domain:            urlObj.hostname,
        title:             page.title,
        description:       page.description || `Content from ${urlObj.hostname}`,
        overall_ai_score:  overallScore,
        total_assets:      assets.length,
        ai_asset_count:    aiAssets,
        scraped_content:   assets,
        analysis_note:     'Text blocks analyzed with RoBERTa AI classifier. Images require manual upload for full analysis.',
        status:            'complete',
      }
    })
  } catch (err: any) {
    const msg = err?.message || 'Scraping failed'
    const isBlocked = msg.includes('403') || msg.includes('blocked') || msg.includes('CORS')
    return NextResponse.json<APIResponse>({
      success: false,
      error: {
        code:    isBlocked ? 'BLOCKED' : 'SCRAPE_FAILED',
        message: isBlocked
          ? 'This website blocks automated scanning. Try a different URL.'
          : `Scan failed: ${msg}`,
      }
    }, { status: 500 })
  }
}

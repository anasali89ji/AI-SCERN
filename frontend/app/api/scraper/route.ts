import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { fetchWithProxy } from '@/lib/proxy/fetch-with-proxy'
import { geminiAvailable } from '@/lib/inference/gemini-analyzer'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

// ── Types ─────────────────────────────────────────────────────────────────────
interface PageData {
  url: string
  title: string
  description: string
  textContent: string
  wordCount: number
  contentType: 'article' | 'product' | 'homepage' | 'forum' | 'documentation' | 'other'
  links: { url: string; text: string; isInternal: boolean }[]
  imageUrls: string[]
  publishDate?: string
  author?: string
}

interface ContentAnalysis {
  aiScore: number
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence: number
  contentQuality: 'high' | 'medium' | 'low'
  signals: { name: string; flagged: boolean; description: string }[]
  summary: string
}

interface SubPageResult {
  url: string
  title: string
  contentType: string
  wordCount: number
  aiScore: number
  verdict: string
  snippet: string
}

// ── HTML Parser ───────────────────────────────────────────────────────────────
function parseHTML(html: string, baseUrl: string): PageData {
  const url = new URL(baseUrl)

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || url.hostname

  const description =
    html.match(/<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']+)/i)?.[1]?.trim() ||
    html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+name=[\"']description[\"']/i)?.[1]?.trim() || ''

  const author =
    html.match(/<meta[^>]+name=[\"']author[\"'][^>]+content=[\"']([^\"']+)/i)?.[1]?.trim() ||
    html.match(/<span[^>]+class=[\"'][^\"']*author[^\"']*[\"'][^>]*>([^<]+)<\/span>/i)?.[1]?.trim()

  const publishDate =
    html.match(/<meta[^>]+property=[\"']article:published_time[\"'][^>]+content=[\"']([^\"']+)/i)?.[1] ||
    html.match(/<time[^>]+datetime=[\"']([^\"']+)[\"']/i)?.[1]

  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  const textBlocks: string[] = []
  const contentTags = /<(p|h[1-6]|article|section|main)[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = contentTags.exec(cleaned)) !== null && textBlocks.length < 50) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text.length > 60) textBlocks.push(text.slice(0, 800))
  }
  const textContent = textBlocks.join('\n\n')
  const wordCount = textContent.split(/\s+/).filter(Boolean).length

  const isArticle = /article|blog|post|news|story/i.test(html) || /article/i.test(url.pathname)
  const isProduct = /product|shop|buy|price|cart|ecommerce/i.test(html)
  const isForum   = /forum|community|discuss|comment|reply/i.test(url.hostname + url.pathname)
  const isDocs    = /docs|documentation|api|reference|guide/i.test(url.pathname)
  const contentType = isArticle ? 'article' : isProduct ? 'product' : isForum ? 'forum' : isDocs ? 'documentation' : url.pathname === '/' ? 'homepage' : 'other'

  const links: PageData['links'] = []
  const linkRegex = /<a[^>]+href=[\"']([^\"'#]+)[\"'][^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi
  while ((m = linkRegex.exec(html)) !== null && links.length < 30) {
    try {
      let href = m[1].trim()
      if (href.startsWith('//')) href = `https:${href}`
      else if (href.startsWith('/')) href = `${url.origin}${href}`
      const linkUrl = new URL(href)
      const linkText = m[2].replace(/<[^>]+>/g, '').trim().slice(0, 100)
      if (linkUrl.protocol.startsWith('http') && linkText.length > 2) {
        links.push({ url: linkUrl.href, text: linkText, isInternal: linkUrl.hostname === url.hostname })
      }
    } catch {}
  }

  const imageUrls: string[] = []
  const imgRegex = /<img[^>]+src=[\"']([^\"']+)[\"']/gi
  while ((m = imgRegex.exec(html)) !== null && imageUrls.length < 15) {
    try {
      let src = m[1]
      if (src.startsWith('//')) src = `https:${src}`
      else if (src.startsWith('/')) src = `${url.origin}${src}`
      if (src.startsWith('http') && !src.includes('tracking') && !src.includes('pixel')) {
        imageUrls.push(src)
      }
    } catch {}
  }

  return { url: baseUrl, title, description, textContent, wordCount, contentType, links, imageUrls, publishDate, author }
}

function detectContentQuality(textContent: string, wordCount: number): 'high' | 'medium' | 'low' {
  if (wordCount < 100) return 'low'
  if (wordCount > 500 && textContent.includes(' ') && !textContent.includes('Lorem ipsum')) return 'high'
  return 'medium'
}

// ── Gemini RAG Analysis ───────────────────────────────────────────────────────
async function analyzeContentWithGemini(
  textContent: string,
  pageTitle: string,
  contentType: string,
  subPageTexts: string[]
): Promise<ContentAnalysis> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const combinedContext = [
    `MAIN PAGE (${contentType}): ${textContent.slice(0, 3000)}`,
    ...subPageTexts.slice(0, 3).map((t, i) => `SUB-PAGE ${i + 1}: ${t.slice(0, 1000)}`),
  ].join('\n\n---\n\n')

  const prompt = `You are an expert AI content detection system analyzing a website's content.

Title: "${pageTitle}"
Content Type: ${contentType}

Full Context (main page + sub-pages):
${combinedContext}

Analyze ALL this content and respond ONLY in this exact JSON format:
{
  "ai_probability": 0.0,
  "verdict": "AI",
  "content_quality": "high",
  "signals": [{"name": "signal name", "flagged": true, "description": "brief explanation"}],
  "summary": "2-3 sentence analysis summary",
  "reasoning": "key evidence for the verdict"
}

AI content signals to detect:
- Unnaturally uniform sentence lengths and structure
- Overuse of transition phrases (Furthermore, Moreover, Additionally, In conclusion)
- Generic hedging without specific personal voice or lived experience
- Suspiciously comprehensive coverage without depth
- Lack of typos, colloquialisms, or natural human imperfections
- Repetitive semantic patterns across paragraphs
- Over-optimization with keywords
- Missing authorship personality or point of view
- For multi-page context: same writing style and cadence across all pages`

  const result = await model.generateContent(prompt)
  const raw = result.response.text()

  try {
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(clean)
    const aiScore = parsed.ai_probability ?? 0.5
    return {
      aiScore,
      verdict: aiScore >= 0.60 ? 'AI' : aiScore <= 0.38 ? 'HUMAN' : 'UNCERTAIN',
      confidence: Math.round(Math.abs(aiScore - 0.5) * 200),
      contentQuality: parsed.content_quality ?? 'medium',
      signals: parsed.signals ?? [],
      summary: parsed.summary ?? `Analysis complete. AI probability: ${Math.round(aiScore * 100)}%`,
    }
  } catch {
    return {
      aiScore: 0.5, verdict: 'UNCERTAIN', confidence: 0,
      contentQuality: 'medium', signals: [], summary: 'Analysis parsing failed',
    }
  }
}

// ── HF Text Fallback ─────────────────────────────────────────────────────────
async function analyzeTextHF(text: string): Promise<{ aiScore: number; verdict: string }> {
  const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
  if (!HF_TOKEN) return { aiScore: 0.5, verdict: 'UNCERTAIN' }
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/openai-community/roberta-base-openai-detector',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
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

// ── Sub-URL Crawler ───────────────────────────────────────────────────────────
async function crawlSubPages(
  links: PageData['links'],
  maxPages: number = 5,
): Promise<SubPageResult[]> {
  const results: SubPageResult[] = []
  const toVisit = links
    .filter(l => l.isInternal || l.url.includes('wikipedia.org') || l.url.includes('medium.com'))
    .slice(0, maxPages)

  await Promise.allSettled(toVisit.map(async (link) => {
    try {
      const res = await fetchWithProxy(link.url, { maxRetries: 1, timeoutMs: 8000 })
      if (!res.ok) return
      const html = await res.text()
      const page = parseHTML(html, link.url)
      if (page.wordCount < 80) return

      const snippetText = page.textContent.slice(0, 600)
      const analysis = await analyzeTextHF(snippetText)

      results.push({
        url:         link.url,
        title:       page.title,
        contentType: page.contentType,
        wordCount:   page.wordCount,
        aiScore:     analysis.aiScore,
        verdict:     analysis.verdict,
        snippet:     snippetText.slice(0, 200) + (snippetText.length > 200 ? '…' : ''),
      })
    } catch {}
  }))

  return results
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
    const body = await req.json()
    const { url, depth = 1, maxSubPages = 5 } = body

    if (!url) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_URL', message: 'URL is required' } },
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

    // ── Fetch main page ──────────────────────────────────────────────────────
    const mainRes = await fetchWithProxy(url, { maxRetries: 2, timeoutMs: 15000 })
    if (!mainRes.ok) throw new Error(`Failed to fetch page: ${mainRes.status}`)
    const mainHtml = await mainRes.text()
    const mainPage = parseHTML(mainHtml, url)

    if (mainPage.wordCount < 30) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: 'No analyzable text content found on this page.' } },
        { status: 422 }
      )
    }

    // ── Crawl sub-pages ──────────────────────────────────────────────────────
    const subPageResults = depth > 0
      ? await crawlSubPages(mainPage.links, maxSubPages)
      : []

    // ── Gemini RAG analysis ──────────────────────────────────────────────────
    const geminiAvail = geminiAvailable()
    let mainAnalysis: ContentAnalysis

    if (geminiAvail) {
      mainAnalysis = await analyzeContentWithGemini(
        mainPage.textContent,
        mainPage.title,
        mainPage.contentType,
        subPageResults.map(s => s.snippet)
      )
    } else {
      const hfResult = await analyzeTextHF(mainPage.textContent.slice(0, 1200))
      mainAnalysis = {
        aiScore:        hfResult.aiScore,
        verdict:        hfResult.verdict as 'AI' | 'HUMAN' | 'UNCERTAIN',
        confidence:     Math.round(Math.abs(hfResult.aiScore - 0.5) * 200),
        contentQuality: detectContentQuality(mainPage.textContent, mainPage.wordCount),
        signals: [{ name: 'AI Text Classifier', flagged: hfResult.verdict === 'AI', description: 'HuggingFace RoBERTa classifier' }],
        summary: `Analysis via HF model. AI score: ${Math.round(hfResult.aiScore * 100)}%`,
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url,
        domain:           urlObj.hostname,
        title:            mainPage.title,
        description:      mainPage.description || `Content from ${urlObj.hostname}`,
        author:           mainPage.author,
        publish_date:     mainPage.publishDate,
        content_type:     mainPage.contentType,
        word_count:       mainPage.wordCount,
        content_quality:  mainAnalysis.contentQuality,
        overall_ai_score: Math.round(mainAnalysis.aiScore * 100),
        verdict:          mainAnalysis.verdict,
        confidence:       mainAnalysis.confidence,
        summary:          mainAnalysis.summary,
        signals:          mainAnalysis.signals,
        image_urls:       mainPage.imageUrls.slice(0, 10),
        sub_pages: subPageResults.map(sp => ({
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
        engine_used:  geminiAvail ? 'Gemini 2.0 Flash RAG' : 'HuggingFace RoBERTa',
      },
    })
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'Scan failed'
    const isBlocked = msg.includes('403') || msg.includes('blocked') || msg.includes('CORS') || msg.includes('ERR_')
    return NextResponse.json({
      success: false,
      error: {
        code:    isBlocked ? 'BLOCKED' : 'SCRAPE_FAILED',
        message: isBlocked
          ? 'This website blocks automated scanning. Try a different URL or use a URL from an article/blog post.'
          : `Scan failed: ${msg}`,
      },
    }, { status: 500 })
  }
}

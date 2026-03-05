import { NextRequest, NextResponse } from 'next/server'
import type { APIResponse } from '@/types'
import { nanoid } from 'nanoid'

function generateMockAssets(url: string) {
  const count = Math.floor(Math.random() * 8) + 4
  const assets = []
  for (let i = 0; i < count; i++) {
    const type = Math.random() > 0.5 ? 'image' : 'text'
    const aiScore = Math.floor(Math.random() * 100)
    assets.push({
      type,
      url: type === 'image' ? `${url}/image_${i}.jpg` : undefined,
      content: type === 'text' ? `Text block ${i + 1} extracted from page...` : undefined,
      verdict: aiScore >= 60 ? 'AI' : aiScore >= 35 ? 'UNCERTAIN' : 'HUMAN',
      confidence: aiScore,
      signals: [
        { name: type === 'image' ? 'Visual Pattern Analysis' : 'Linguistic Fingerprint', flagged: aiScore >= 60 },
        { name: type === 'image' ? 'Metadata Forensics' : 'Style Consistency', flagged: aiScore >= 50 },
      ]
    })
  }
  return assets
}

export async function POST(req: NextRequest) {
  const requestId = nanoid()
  const startTime = Date.now()
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json<APIResponse>({ success: false, error: { code: 'NO_URL', message: 'URL is required' } }, { status: 400 })

    let urlObj: URL
    try { urlObj = new URL(url) } catch {
      return NextResponse.json<APIResponse>({ success: false, error: { code: 'INVALID_URL', message: 'Invalid URL format' } }, { status: 400 })
    }

    // Simulate scraping with realistic mock data
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500))

    const assets = generateMockAssets(url)
    const aiAssets = assets.filter(a => a.verdict === 'AI').length
    const overallScore = Math.round((aiAssets / assets.length) * 100)

    const result = {
      url,
      title: `${urlObj.hostname} — Analyzed Page`,
      description: `Content analysis of ${urlObj.hostname}. ${assets.length} assets detected and analyzed for AI generation patterns.`,
      overall_ai_score: overallScore,
      total_assets: assets.length,
      ai_asset_count: aiAssets,
      assets,
    }

    return NextResponse.json<APIResponse>({
      success: true, data: result,
      meta: { processing_time: Date.now() - startTime, request_id: requestId }
    })
  } catch {
    return NextResponse.json<APIResponse>({ success: false, error: { code: 'SCRAPE_FAILED', message: 'Failed to analyze URL. The site may block scraping.' } }, { status: 500 })
  }
}

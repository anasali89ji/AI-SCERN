import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    const body = await req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const hostname = parsedUrl.hostname
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) {
      return NextResponse.json({ error: 'Private addresses are not allowed' }, { status: 403 })
    }

    const mockResult = {
      id: `web-${Date.now()}`,
      url: parsedUrl.toString(),
      verdict: Math.random() > 0.7 ? 'AI' : 'HUMAN',
      confidence: 0.6 + Math.random() * 0.35,
      scannedAt: new Date().toISOString(),
      details: [
        { verdict: 'HUMAN', message: 'HTML structure shows natural DOM nesting patterns' },
        { verdict: 'AI', message: 'Meta tags contain generator signatures consistent with AI platforms' },
        { verdict: 'HUMAN', message: 'Image assets pass initial forensic checks' },
      ],
      metadata: {
        title: 'Scanned Page',
        contentType: 'text/html',
        finalUrl: parsedUrl.toString(),
      },
    }

    return NextResponse.json(mockResult)
  } catch (err: any) {
    console.error('Web verification error:', err)
    return NextResponse.json({ error: 'Internal verification error' }, { status: 500 })
  }
}

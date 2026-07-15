import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Scan ID required' }, { status: 400 })
    }

    return NextResponse.json({
      id,
      userId,
      status: 'completed',
      type: 'image',
      verdict: 'HUMAN',
      confidence: 0.94,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      completedAt: new Date().toISOString(),
      metadata: {
        filename: 'sample.jpg',
        fileSize: 2400000,
        dimensions: { width: 1920, height: 1080 },
      },
      report: {
        summary: 'No synthetic indicators detected.',
        indicators: [
          { name: 'Noise Analysis', score: 0.97, status: 'pass' },
          { name: 'ELA Consistency', score: 0.91, status: 'pass' },
          { name: 'PRNU Match', score: 0.88, status: 'pass' },
        ],
      },
    })
  } catch (err: any) {
    console.error('Scan fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch scan' }, { status: 500 })
  }
}

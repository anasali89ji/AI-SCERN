import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Internal endpoint for cron services to keep functions warm
// Only responds to requests with the internal secret
export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Internal-Secret') || req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ status: 'warm', timestamp: new Date().toISOString() })
}

// Allow GET for simple uptime pings (no auth required — same as /api/health)
export async function GET() {
  return NextResponse.json({ status: 'warm', timestamp: new Date().toISOString() })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-middleware'
import { addClient, removeClient, pollForChanges } from '@/lib/realtime'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const encoder = new TextEncoder()
  let clientId = ''

  const stream = new ReadableStream({
    start(controller) {
      clientId = addClient(controller)
      controller.enqueue(encoder.encode('data: {\"type\":\"connected\",\"timestamp\":\"' + new Date().toISOString() + '\"}\n\n'))
    },
    cancel() {
      removeClient(clientId)
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

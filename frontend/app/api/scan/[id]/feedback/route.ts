import { NextRequest, NextResponse } from 'next/server'
import { auth }               from '@clerk/nextjs/server'
import { inngest }            from '@/lib/inngest/client'
import { getSupabaseAdmin }   from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })

  const { id } = await params
  try {
    const { feedback } = await req.json()
    if (!['correct', 'incorrect'].includes(feedback))
      return NextResponse.json({ success: false, error: { code: 'INVALID_FEEDBACK', message: 'Invalid feedback value' } }, { status: 400 })

    const db = getSupabaseAdmin()

    // Verify scan ownership before updating
    const { data: scan } = await db.from('scans').select('user_id,verdict,media_type,confidence_score').eq('id', id).single()
    if (!scan || scan.user_id !== userId)
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 })

    await db.from('scans').update({ user_feedback: feedback }).eq('id', id)

    if (feedback === 'incorrect') {
      await db.from('pipeline_jobs').insert({
        job_type: 'augment', priority: 5,
        payload: { scan_id: id, media_type: scan.media_type, verdict: scan.verdict, confidence: scan.confidence_score, feedback: 'incorrect' },
      })
    }

    void (async () => {
      try {
        await inngest.send({ name: 'scan/feedback', data: { scan_id: id, user_id: userId, feedback, verdict: scan.verdict ?? '' } })
      } catch { /* non-fatal */ }
    })()

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: err instanceof Error ? err.message : 'Failed' } }, { status: 500 })
  }
}

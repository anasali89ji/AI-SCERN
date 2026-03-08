import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? 'placeholder-anon-key'
)

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { feedback } = await req.json()
    if (!['correct', 'incorrect'].includes(feedback)) {
      return NextResponse.json({ success: false, error: 'Invalid feedback value' }, { status: 400 })
    }

    const { error } = await supabase
      .from('scans')
      .update({ user_feedback: feedback })
      .eq('id', params.id)

    if (error) throw error

    // If incorrect: enqueue augment job for self-improving loop
    if (feedback === 'incorrect') {
      const { data: scan } = await supabase.from('scans').select('*').eq('id', params.id).single()
      if (scan) {
        await supabase.from('pipeline_jobs').insert({
          job_type:    'augment',
          priority:    5,
          payload: {
            scan_id:    scan.id,
            media_type: scan.media_type,
            verdict:    scan.verdict,
            confidence: scan.confidence_score,
            feedback:   'incorrect',
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

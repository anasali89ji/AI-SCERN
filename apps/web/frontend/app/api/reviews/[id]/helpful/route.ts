import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getSupabaseAdmin()
    const { error } = await db.rpc('increment_helpful', { review_id: id })
    if (error) {
      // Fallback: manual increment
      const { data: current } = await db.from('reviews').select('helpful_count').eq('id', id).single()
      await db.from('reviews').update({ helpful_count: (current?.helpful_count ?? 0) + 1 }).eq('id', id)
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getSupabaseAdmin()

    // Fetch all published reviews just for aggregate stats (select minimal fields)
    const { data, error } = await db
      .from('reviews')
      .select('rating, helpful_count, verified, is_anonymous')
      .eq('published', true)

    if (error) throw error

    const reviews = data ?? []
    const total = reviews.length

    if (total === 0) {
      return NextResponse.json({
        avg: '0.0',
        total: 0,
        breakdown: [5,4,3,2,1].map(n => ({ n, count: 0, pct: 0 })),
        verified: 0,
        anonymous: 0,
        helpfulVotes: 0,
      })
    }

    const avg = (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    const breakdown = [5,4,3,2,1].map(n => {
      const count = reviews.filter(r => r.rating === n).length
      return { n, count, pct: Math.round(count / total * 100) }
    })

    return NextResponse.json({
      avg,
      total,
      breakdown,
      verified:    reviews.filter(r => r.verified).length,
      anonymous:   reviews.filter(r => r.is_anonymous).length,
      helpfulVotes: reviews.reduce((s, r) => s + (r.helpful_count || 0), 0),
    })
  } catch {
    return NextResponse.json({ avg: '0.0', total: 0, breakdown: [], verified: 0, anonymous: 0, helpfulVotes: 0 })
  }
}

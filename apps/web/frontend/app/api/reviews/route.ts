import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = 12
    const offset = (page - 1) * limit
    const sort  = searchParams.get('sort') ?? 'helpful'

    const ratingFilter = parseInt(searchParams.get('rating') ?? '0')

    const db = getSupabaseAdmin()
    let query = db.from('reviews').select('*', { count: 'exact' }).eq('published', true)

    // Star filter — show ALL ratings (1-5), not just positive ones
    if (ratingFilter >= 1 && ratingFilter <= 5) {
      query = query.eq('rating', ratingFilter)
    }

    if (sort === 'newest')       query = query.order('created_at', { ascending: false })
    else if (sort === 'top')     query = query.order('rating', { ascending: false }).order('helpful_count', { ascending: false })
    else if (sort === 'lowest')  query = query.order('rating', { ascending: true }).order('created_at', { ascending: false })
    else                         query = query.order('helpful_count', { ascending: false })

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    // Mask user_id, apply anonymous display
    const sanitized = (data ?? []).map((r: any) => ({
      id:           r.id,
      display_name: r.is_anonymous ? 'Anonymous User' : (r.display_name || 'Aiscern User'),
      is_anonymous: r.is_anonymous,
      rating:       r.rating,
      title:        r.title,
      body:         r.body,
      tool_used:    r.tool_used,
      helpful_count: r.helpful_count,
      verified:     r.verified,
      created_at:   r.created_at,
    }))

    return NextResponse.json(
      { data: sanitized, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } }
    )
  } catch {
    return NextResponse.json({ data: [], total: 0, pages: 0 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Sign in to leave a review' }, { status: 401 })
    }

    const body = await req.json()
    const { rating, title, body: reviewBody, toolUsed, displayName, isAnonymous } = body

    if (!rating || rating < 1 || rating > 5)
      return NextResponse.json({ error: 'Rating must be 1–5 stars' }, { status: 400 })
    if (!title?.trim() || title.length > 100)
      return NextResponse.json({ error: 'Title required (max 100 characters)' }, { status: 400 })
    if (!reviewBody?.trim() || reviewBody.length < 30 || reviewBody.length > 1000)
      return NextResponse.json({ error: 'Review must be 30–1000 characters' }, { status: 400 })

    // Check if user already reviewed
    const db = getSupabaseAdmin()
    const { data: existing } = await db.from('reviews').select('id').eq('user_id', userId).single()
    if (existing) {
      return NextResponse.json({ error: 'You have already submitted a review' }, { status: 409 })
    }

    const { data, error } = await db.from('reviews').insert({
      user_id:      userId,
      display_name: isAnonymous ? null : (displayName?.trim() || null),
      is_anonymous: !!isAnonymous,
      rating,
      title:        title.trim(),
      body:         reviewBody.trim(),
      tool_used:    toolUsed || null,
      helpful_count: 0,
      verified:     false,
      published:    true,
      created_at:   new Date().toISOString(),
    }).select().single()

    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'You have already submitted a review' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to submit review. Please try again.' }, { status: 500 })
  }
}

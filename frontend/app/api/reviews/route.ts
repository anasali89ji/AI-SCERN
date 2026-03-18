import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page  = parseInt(searchParams.get('page') ?? '1')
    const limit = 12
    const offset = (page - 1) * limit

    const db = getSupabaseAdmin()
    const { data, error, count } = await db
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('published', true)
      .order('helpful_count', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return NextResponse.json({ data: data ?? [], total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) })
  } catch (err: any) {
    // Fallback: return empty if table doesn't exist yet
    return NextResponse.json({ data: [], total: 0, pages: 0 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Sign in to leave a review' }, { status: 401 })

    const body = await req.json()
    const { rating, title, body: reviewBody, toolUsed } = body

    if (!rating || rating < 1 || rating > 5)
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 })
    if (!title?.trim() || title.length > 100)
      return NextResponse.json({ error: 'Title required (max 100 chars)' }, { status: 400 })
    if (!reviewBody?.trim() || reviewBody.length < 20 || reviewBody.length > 1000)
      return NextResponse.json({ error: 'Review must be 20-1000 chars' }, { status: 400 })

    const db = getSupabaseAdmin()
    const { data, error } = await db.from('reviews').insert({
      user_id: userId, rating, title,
      body: reviewBody, tool_used: toolUsed,
      verified: false, helpful_count: 0, published: true,
      created_at: new Date().toISOString(),
    }).select().single()

    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}

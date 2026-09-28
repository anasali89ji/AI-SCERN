import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function suggestUsernames(base: string): string[] {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
  const rand  = () => Math.floor(Math.random() * 900) + 100
  return [
    `${clean}${rand()}`,
    `${clean}_${rand()}`,
    `${clean}x`,
    `the_${clean}`,
    `real_${clean}`,
  ].slice(0, 4)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')?.trim()
  if (!username || username.length < 3)
    return NextResponse.json({ available: false, error: 'Username must be at least 3 characters' }, { status: 400 })
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
    return NextResponse.json({ available: false, error: 'Only letters, numbers, and underscores allowed (3–30 chars)' })

  const { userId } = await auth()
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .neq('id', userId ?? '')
    .maybeSingle()

  const available = !data
  const suggestions = available ? [] : suggestUsernames(username)
  return NextResponse.json({ available, suggestions })
}

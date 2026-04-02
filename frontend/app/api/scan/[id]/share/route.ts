import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@clerk/nextjs/server'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('scans')
    .update({ is_public: true })
    .eq('id', id)
    .eq('user_id', userId)   // users can only share their own scans
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: 'Scan not found or not owned by you' },
      { status: 404 },
    )
  }

  return NextResponse.json({
    success:   true,
    share_url: `/scan/${id}`,
  })
}

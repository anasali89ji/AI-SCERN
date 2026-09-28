import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse }       from 'next/server'
import { getSupabaseAdmin }   from '@/lib/supabase/admin'
import { deleteR2Object }     from '@/lib/storage/r2'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sb = getSupabaseAdmin()

    // 1. Get all scans to clean up R2 + training_feedback
    const { data: userScans } = await sb.from('scans').select('id,r2_key').eq('user_id', userId)

    // 2. Delete training_feedback by scan IDs (GDPR compliance)
    if (userScans?.length) {
      const scanIds = userScans.map((s: any) => s.id)
      await sb.from('training_feedback').delete().in('scan_id', scanIds)

      // 3. Delete R2 objects
      const r2Keys = userScans.filter((s: any) => s.r2_key).map((s: any) => s.r2_key as string)
      await Promise.allSettled(r2Keys.map((key: string) => deleteR2Object(key)))
    }

    // 4. Delete in dependency order
    await sb.from('scans').delete().eq('user_id', userId)
    await sb.from('api_keys').delete().eq('user_id', userId)
    await sb.from('profiles').delete().eq('id', userId)

    // 5. Delete Clerk user — invalidates all sessions
    const clerk = await clerkClient()
    await clerk.users.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[delete-account]', err)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}

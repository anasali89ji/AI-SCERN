import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('profiles')
    .select('onboarding_completed, account_type, organization_name, organization_type, job_title')
    .eq('id', userId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    onboarding_completed: (data as any)?.onboarding_completed ?? false,
    account_type:         (data as any)?.account_type ?? 'individual',
    organization_name:    (data as any)?.organization_name ?? null,
    organization_type:    (data as any)?.organization_type ?? null,
    job_title:            (data as any)?.job_title ?? null,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isOrganizationEmail, getEmailDomain, ORG_TYPES } from '@/lib/auth/organizationEmail'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'display_name', 'username', 'bio', 'avatar_url', 'preferred_modalities',
    'onboarding_completed', 'onboarding_step',
    'account_type', 'organization_name', 'organization_type', 'job_title',
  ]
  const update: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (update.username) {
    const db = getSupabaseAdmin()
    const { data: existing } = await db.from('profiles').select('id').ilike('username', update.username).neq('id', userId).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  // ── Account type validation ──────────────────────────────────────────────
  // Never trust a client-submitted organization_domain — always re-derive it
  // from the authenticated Clerk session's verified email address. This is
  // the check that actually matters; anything client-side is UX only.
  if ('account_type' in update) {
    if (update.account_type !== 'individual' && update.account_type !== 'organization') {
      return NextResponse.json({ error: 'Invalid account type' }, { status: 400 })
    }

    if (update.account_type === 'organization') {
      const orgName = typeof update.organization_name === 'string' ? update.organization_name.trim() : ''
      const orgType = update.organization_type

      if (orgName.length < 2) {
        return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
      }
      if (!ORG_TYPES.includes(orgType)) {
        return NextResponse.json({ error: 'Invalid organization type' }, { status: 400 })
      }

      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(userId)
      const verifiedEmail = clerkUser.emailAddresses.find(
        e => e.id === clerkUser.primaryEmailAddressId && e.verification?.status === 'verified'
      )?.emailAddress ?? clerkUser.primaryEmailAddress?.emailAddress ?? null

      if (!isOrganizationEmail(verifiedEmail)) {
        return NextResponse.json(
          { error: 'Organization accounts require a work or institution email address — please use your organization email, or continue with an individual account.' },
          { status: 400 },
        )
      }

      update.organization_name   = orgName
      update.organization_type   = orgType
      update.organization_domain = getEmailDomain(verifiedEmail)
      update.job_title           = typeof update.job_title === 'string' ? update.job_title.trim().slice(0, 100) : null
    } else {
      // Switching to / confirming individual — the DB constraint requires
      // these to be null, so clear them regardless of what else was sent.
      update.organization_name   = null
      update.organization_type   = null
      update.organization_domain = null
      update.job_title           = null
    }
  }

  const db = getSupabaseAdmin()
  const { error } = await db.from('profiles').update(update).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

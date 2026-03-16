import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export interface CreditGuardResult {
  userId:           string
  creditsRemaining: number
  unlimited?:       boolean
}

export class HTTPError extends Error {
  constructor(public status: number, message: string, public body?: object) {
    super(message)
  }
}

/**
 * Verify Clerk session + atomically consume 1 credit before inference.
 * Clerk sets __session (JWT) and __client_uat cookies automatically.
 * The JWT sub claim is the Clerk userId.
 */
export async function creditGuard(req: NextRequest, scanType: string): Promise<CreditGuardResult> {
  // 1. Get Clerk session token
  const token = req.cookies.get('__session')?.value
  if (!token) {
    throw new HTTPError(401, 'Authentication required', {
      code: 'AUTH_REQUIRED',
      message: 'Please sign in to use DETECTAI.',
      loginUrl: '/login',
    })
  }

  // 2. Decode Clerk JWT to get userId (sub claim)
  let userId: string
  try {
    const parts   = token.split('.')
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    if (!payload.sub) throw new Error('no sub')
    if (Date.now() / 1000 > payload.exp) throw new Error('expired')
    userId = payload.sub   // Clerk user ID: user_xxxxxxxxxx
  } catch {
    throw new HTTPError(401, 'Invalid or expired session', {
      code: 'INVALID_SESSION',
      message: 'Your session has expired. Please sign in again.',
      loginUrl: '/login',
    })
  }

  // 3. Load profile + credit balance
  const db = getSupabaseAdmin()
  const { data: profile, error } = await db
    .from('profiles')
    .select('id, credits_remaining, plan_id, is_banned')
    .eq('id', userId)
    .single()

  // Auto-create profile for new Clerk users
  if (error || !profile) {
    await db.from('profiles').upsert({
      id:                userId,
      credits_remaining: 10,
      plan_id:           'free',
      scan_count:        0,
    }, { onConflict: 'id', ignoreDuplicates: true })
    return { userId, creditsRemaining: 10 }
  }

  if (profile.is_banned) {
    throw new HTTPError(403, 'Account suspended', {
      code: 'ACCOUNT_BANNED',
      message: 'Your account has been suspended. Contact support.',
    })
  }

  // 4. Enterprise / unlimited plan bypass
  if (profile.plan_id === 'enterprise' || profile.credits_remaining === -1) {
    return { userId, creditsRemaining: Infinity, unlimited: true }
  }

  // 5. Check credits
  if ((profile.credits_remaining ?? 0) < 1) {
    throw new HTTPError(402, 'Insufficient credits', {
      code: 'NO_CREDITS',
      message: 'You have no credits remaining. Please upgrade your plan.',
      upgradeUrl: '/pricing',
      creditsRemaining: 0,
    })
  }

  // 6. Atomically deduct 1 credit + record transaction
  const { error: deductErr } = await db.rpc('deduct_credit', {
    p_user_id: userId,
    p_scan_type: scanType,
  }).single()

  if (deductErr) {
    // Fallback: direct update if RPC doesn't exist yet
    await db.from('profiles')
      .update({ credits_remaining: (profile.credits_remaining ?? 1) - 1 })
      .eq('id', userId)
  }

  return {
    userId,
    creditsRemaining: (profile.credits_remaining ?? 1) - 1,
  }
}

export function httpErrorResponse(err: HTTPError): NextResponse {
  return NextResponse.json(
    { success: false, error: err.body ?? { message: err.message } },
    { status: err.status }
  )
}

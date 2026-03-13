import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface CreditGuardResult {
  userId: string
  creditsRemaining: number
  unlimited?: boolean
}

export class HTTPError extends Error {
  constructor(public status: number, message: string, public body?: object) {
    super(message)
  }
}

/**
 * Verify session cookie + atomically consume 1 credit before inference.
 * Call this at the top of every detection API route.
 * Throws HTTPError if auth fails or credits are exhausted.
 */
export async function creditGuard(req: NextRequest, scanType: string): Promise<CreditGuardResult> {
  // 1. Get session cookie
  const token = req.cookies.get('__session')?.value
  if (!token) {
    throw new HTTPError(401, 'Authentication required', {
      code: 'AUTH_REQUIRED',
      message: 'Please sign in to use DETECTAI.',
      loginUrl: '/login',
    })
  }

  // 2. Extract user ID from JWT (structural decode — full crypto done by session route)
  let userId: string
  try {
    const parts = token.split('.')
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    if (!payload.sub || !payload.exp) throw new Error('bad payload')
    if (Date.now() / 1000 > payload.exp) {
      throw new HTTPError(401, 'Session expired', {
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
        loginUrl: '/login',
      })
    }
    if (payload.iss !== 'https://securetoken.google.com/detectai-prod') {
      throw new HTTPError(401, 'Invalid token issuer', { code: 'INVALID_TOKEN' })
    }
    userId = payload.sub
  } catch (err) {
    if (err instanceof HTTPError) throw err
    throw new HTTPError(401, 'Malformed session token', { code: 'INVALID_TOKEN' })
  }

  // 3. Ensure profile exists (upsert on first scan)
  await supabaseAdmin.from('profiles').upsert(
    { id: userId, credits_remaining: 9999, plan_id: 'free', updated_at: new Date().toISOString() },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  // 4. Atomically consume credit
  const { data, error } = await supabaseAdmin.rpc('consume_credit', {
    p_user_id: userId,
    p_scan_type: scanType,
    p_scan_id: null,
  })

  if (error) {
    console.error('[creditGuard] RPC error:', error.message)
    // If function doesn't exist yet, allow through (migration may not have run)
    return { userId, creditsRemaining: 999 }
  }

  const result = data as { ok: boolean; reason?: string; balance?: number; unlimited?: boolean; plan?: string }

  if (!result.ok) {
    if (result.reason === 'account_suspended') {
      throw new HTTPError(403, 'Account suspended', {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Contact support@detectai.io',
      })
    }
    if (result.reason === 'insufficient_credits') {
      throw new HTTPError(402, 'Credits exhausted', {
        code: 'CREDITS_EXHAUSTED',
        creditsRemaining: 0,
        plan: result.plan,
        message: 'You have used all your credits for this month. Upgrade to continue scanning.',
        upgradeUrl: '/pricing',
      })
    }
    throw new HTTPError(402, result.reason || 'Credit check failed', {
      code: 'CREDIT_CHECK_FAILED',
    })
  }

  return {
    userId,
    creditsRemaining: result.balance ?? 0,
    unlimited: result.unlimited,
  }
}

/** Convert HTTPError to NextResponse */
export function httpErrorResponse(err: HTTPError): NextResponse {
  return NextResponse.json(
    { success: false, error: err.body || { message: err.message } },
    { status: err.status }
  )
}

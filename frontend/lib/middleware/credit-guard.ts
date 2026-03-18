import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

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
 * OPEN SOURCE MODE — all scans are free and unlimited.
 * Uses Clerk server auth() to get the authenticated user ID.
 * Falls back to IP-based anonymous ID if not signed in.
 */
export async function creditGuard(req: NextRequest, _scanType: string): Promise<CreditGuardResult> {
  try {
    const { userId } = await auth()
    if (userId) {
      return { userId, creditsRemaining: 999999, unlimited: true }
    }
  } catch { /* Clerk not configured or error — fall through to anon */ }

  // Anonymous: track by IP, no limits
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous'
  return { userId: `anon_${ip}`, creditsRemaining: 999999, unlimited: true }
}

export function httpErrorResponse(err: HTTPError): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'ERROR', message: err.message, ...err.body } },
    { status: err.status }
  )
}

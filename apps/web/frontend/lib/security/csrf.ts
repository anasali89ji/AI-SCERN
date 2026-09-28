/**
 * lib/security/csrf.ts
 *
 * CSRF protection for all mutating API routes (POST, PUT, DELETE, PATCH).
 *
 * Strategy: Origin / Referer header validation.
 * - Browsers always send Origin for cross-origin requests.
 * - If Origin is missing, fall back to Referer.
 * - If both are absent on a mutating request → reject (except API-key calls).
 *
 * Usage in an API route:
 *
 *   import { validateCsrf } from '@/lib/security/csrf'
 *
 *   export async function POST(req: NextRequest) {
 *     const csrf = validateCsrf(req)
 *     if (!csrf.ok) {
 *       return NextResponse.json({ error: csrf.reason }, { status: 403 })
 *     }
 *     // ... rest of handler
 *   }
 */

import { NextRequest } from 'next/server'

/** Origins that are allowed to make mutating requests */
const ALLOWED_ORIGINS = new Set([
  'https://aiscern.com',
  'https://www.aiscern.com',
  'https://app.aiscern.com',
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
])

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

export interface CsrfResult {
  ok: boolean
  reason?: string
}

/**
 * Validate CSRF for a request.
 * Safe methods (GET, HEAD, OPTIONS) always pass.
 * Mutating methods require a valid Origin or Referer.
 *
 * API key requests (Authorization: Bearer aiscern_...) bypass CSRF
 * because they originate from server-to-server calls, not browsers.
 */
export function validateCsrf(req: NextRequest): CsrfResult {
  const method = req.method?.toUpperCase() ?? 'GET'

  // Safe methods — no CSRF risk
  if (!MUTATING_METHODS.has(method)) {
    return { ok: true }
  }

  // API key requests bypass CSRF — they use HMAC-signed tokens, not cookies
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer aiscern_') || authHeader.startsWith('Bearer aik_')) {
    return { ok: true }
  }

  // Internal server-to-server calls
  const internalSecret = req.headers.get('x-internal-secret')
  if (internalSecret && internalSecret === process.env.INTERNAL_API_SECRET) {
    return { ok: true }
  }

  // Check Origin header first
  const origin = req.headers.get('origin')
  if (origin) {
    if (ALLOWED_ORIGINS.has(origin)) {
      return { ok: true }
    }
    return {
      ok: false,
      reason: `CSRF: origin "${origin}" is not allowed`,
    }
  }

  // Fallback: check Referer
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin
      if (ALLOWED_ORIGINS.has(refererOrigin)) {
        return { ok: true }
      }
      return {
        ok: false,
        reason: `CSRF: referer origin "${refererOrigin}" is not allowed`,
      }
    } catch {
      return { ok: false, reason: 'CSRF: malformed Referer header' }
    }
  }

  // Neither Origin nor Referer present on a mutating request
  // This is suspicious — browsers always send one of these for same-site requests
  return {
    ok: false,
    reason: 'CSRF: missing Origin and Referer headers',
  }
}

/**
 * Check if the current environment is development.
 * In development, CSRF is relaxed to allow tools like Postman.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * CSRF validation that's relaxed in development.
 * Use this variant for routes where you want to test easily with curl/Postman.
 */
export function validateCsrfDev(req: NextRequest): CsrfResult {
  if (isDevelopment()) return { ok: true }
  return validateCsrf(req)
}

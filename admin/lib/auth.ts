import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export const COOKIE_NAME = 'admin_session'

// ── Edge-safe Buffer replacement ──────────────────────────────────────────────
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToUint8(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

// ── Config validation ─────────────────────────────────────────────────────────
export function validateAdminConfig(): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_BCRYPT) {
    errors.push('ADMIN_PASSWORD or ADMIN_PASSWORD_BCRYPT is missing')
  }
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
    errors.push('ADMIN_SESSION_SECRET is missing or < 32 chars')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('Supabase credentials missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  return { ok: errors.length === 0, errors }
}

// ── Secret resolution ─────────────────────────────────────────────────────────
function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    console.error('[auth] ADMIN_SESSION_SECRET env var is missing or too short (need ≥32 chars). Generate: openssl rand -hex 32')
    return null
  }
  return secret
}

// ── HMAC helpers (Web Crypto — fully edge-compatible) ─────────────────────────
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return bufToHex(sig)
}

async function hmacVerify(data: string, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret)
  const a = hexToUint8(expected)
  const b = hexToUint8(sig.padEnd(expected.length, '0'))
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ── Session management ────────────────────────────────────────────────────────
const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

export async function createAdminSession(ip: string, userAgent: string): Promise<string> {
  const secret = getSessionSecret()
  if (!secret) throw new Error('Session secret not configured')

  const payload = `admin:${ip}:${Date.now()}`
  const sig     = await hmacSign(payload, secret)
  const token   = `${payload}:${sig}`

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    await sb.from('admin_sessions').insert({
      session_token: token,
      ip_address:    ip,
      user_agent:    userAgent,
      expires_at:    new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    await sb.from('admin_audit_log').insert({
      action:   'login_success',
      admin_ip: ip,
      metadata: { user_agent: userAgent },
    })
  } catch { /* non-fatal — session still works via HMAC */ }

  return token
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false

  const secret = getSessionSecret()
  if (!secret) return false // misconfigured — deny all

  const parts = token.split(':')
  if (parts.length < 4) return false

  const sig  = parts.pop()!
  const data = parts.join(':')

  // 1. Verify HMAC signature
  const valid = await hmacVerify(data, sig, secret)
  if (!valid) return false

  // 2. Verify expiry
  const ts = parseInt(parts[parts.length - 1])
  if (isNaN(ts) || Date.now() - ts > SESSION_TTL_MS) return false

  // 3. Check Supabase revocation table
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: row, error } = await sb
      .from('admin_sessions')
      .select('revoked_at, expires_at')
      .eq('session_token', token)
      .maybeSingle()

    if (error) {
      console.error('[auth] Supabase revocation check failed:', error.message)
      return false
    }
    if (!row) return false
    if (row.revoked_at) return false
    if (new Date(row.expires_at) < new Date()) return false
  } catch {
    return false
  }

  return true
}

export async function revokeAdminSession(token: string): Promise<void> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    await sb
      .from('admin_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('session_token', token)
  } catch {}
}

// ── Password verification ─────────────────────────────────────────────────────
// Priority order:
//   1. ADMIN_PASSWORD_BCRYPT — bcrypt hash (most secure, recommended for prod)
//   2. ADMIN_PASSWORD        — 64-char SHA-256 hex hash (prod) or plaintext (dev only)
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false

  // Option 1: bcrypt hash (preferred)
  const bcryptHash = process.env.ADMIN_PASSWORD_BCRYPT
  if (bcryptHash && bcryptHash.trim() !== '') {
    try {
      return await bcrypt.compare(password, bcryptHash)
    } catch (e) {
      console.error('[auth] bcrypt compare failed:', e)
      return false
    }
  }

  // Option 2: SHA-256 hex or plaintext
  const stored = process.env.ADMIN_PASSWORD
  if (!stored || stored.trim() === '') {
    console.error('[auth] ADMIN_PASSWORD env var is not set. Admin login is disabled.')
    return false
  }

  const isHash = stored.length === 64 && /^[0-9a-f]{64}$/.test(stored)

  if (!isHash) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth] ADMIN_PASSWORD must be a 64-char SHA-256 hex hash in production. Generate: echo -n "pw" | sha256sum')
      return false
    }
    // Dev only: constant-time plaintext compare
    const enc = new TextEncoder()
    const a   = enc.encode(password)
    const b   = enc.encode(stored)
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  }

  // SHA-256 hash compare (edge-safe)
  const enc     = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(password))
  const hashHex = bufToHex(hashBuf)

  const a = enc.encode(hashHex)
  const b = enc.encode(stored)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ── Utilities ─────────────────────────────────────────────────────────────────
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

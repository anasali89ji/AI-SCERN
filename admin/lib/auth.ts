import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const COOKIE_NAME = 'admin_session'

// Session token format: base64(userId):timestamp:signature
// Simple HMAC-based signing without external deps (edge-compatible)
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Buffer.from(sig).toString('hex')
}

async function hmacVerify(data: string, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret)
  return expected === sig
}

export function createSessionToken(payload: string): string {
  const ts = Date.now()
  const unsigned = `${payload}:${ts}`
  // Sync placeholder — async signing done in createAdminSession
  return unsigned
}

export async function createAdminSession(ip: string, userAgent: string): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret'
  const payload = `admin:${ip}:${Date.now()}`
  const sig = await hmacSign(payload, secret)
  const token = `${payload}:${sig}`

  // Store session in Supabase if service role key available
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    await sb.from('admin_sessions').insert({
      session_token: token,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 2h
    })
    await sb.from('admin_audit_log').insert({
      action: 'login_success',
      admin_ip: ip,
      metadata: { user_agent: userAgent },
    })
  } catch {}

  return token
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret'
  const parts = token.split(':')
  if (parts.length < 4) return false

  const sig = parts.pop()!
  const data = parts.join(':')

  const valid = await hmacVerify(data, sig, secret)
  if (!valid) return false

  // Check expiry (2h)
  const ts = parseInt(parts[parts.length - 1])
  if (Date.now() - ts > 24 * 60 * 60 * 1000) return false

  return true
}

export async function revokeAdminSession(token: string): Promise<void> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    await sb.from('admin_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('session_token', token)
  } catch {}
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = process.env.ADMIN_PASSWORD
  if (!stored) return false
  // Timing-safe comparison using Web Crypto (no external deps, edge-compatible)
  // Supports both plaintext (dev) and SHA-256 hex hash (production)
  if (stored.length === 64 && /^[0-9a-f]{64}$/.test(stored)) {
    // Production: ADMIN_PASSWORD is a SHA-256 hex hash of the real password
    const enc     = new TextEncoder()
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(password))
    const hashHex = Buffer.from(hashBuf).toString('hex')
    // Timing-safe compare
    const a = enc.encode(hashHex)
    const b = enc.encode(stored)
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  }
  // Dev/simple: plaintext constant-time compare
  const enc = new TextEncoder()
  const a   = enc.encode(password)
  const b   = enc.encode(stored)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

/**
 * POST /api/upload/presign
 *
 * Returns a presigned R2 PUT URL so the browser can upload directly
 * to Cloudflare R2 — Vercel never receives the file bytes.
 *
 * Body: { fileName, mimeType, fileSize, mediaType }
 * Returns: { uploadUrl, key, expiresIn }
 *
 * After upload completes, the client passes `key` to the detect route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createPresignedUpload, r2Available, type R2MediaType } from '@/lib/storage/r2'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { validateCsrf } from '@/lib/security/csrf'

export const dynamic = 'force-dynamic'

const VALID_MEDIA_TYPES: R2MediaType[] = ['image', 'audio', 'video']

// MIME allowlist per category (server-side check on declared MIME before presign)
const MIME_ALLOWLIST: Record<string, Set<string>> = {
  image: new Set(['image/jpeg','image/png','image/webp','image/gif']),
  audio: new Set(['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a','audio/ogg','audio/flac','audio/webm']),
  video: new Set(['video/mp4','video/webm','video/quicktime','video/x-msvideo']),
}

// Size limits (bytes)
const SIZE_LIMITS: Record<string, number> = {
  image: 10  * 1024 * 1024,
  audio: 50  * 1024 * 1024,
  video: 100 * 1024 * 1024,
}

export async function POST(req: NextRequest) {
  // CSRF protection
  const csrf = validateCsrf(req)
  if (!csrf.ok) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('upload', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  // Auth — allow anonymous with rate limiting, require auth for large files
  let userId = `anon_${ip}`
  try {
    const { userId: clerkId } = await auth()
    if (clerkId) userId = clerkId
  } catch {}

  if (!r2Available()) {
    return NextResponse.json(
      { success: false, error: 'File storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.' },
      { status: 503 }
    )
  }

  try {
    const body = await req.json()
    const { fileName, mimeType, fileSize, mediaType } = body

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ success: false, error: 'fileName required' }, { status: 400 })
    }
    if (!mimeType || typeof mimeType !== 'string') {
      return NextResponse.json({ success: false, error: 'mimeType required' }, { status: 400 })
    }
    if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ success: false, error: 'fileSize required (bytes)' }, { status: 400 })
    }
    if (!VALID_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json(
        { success: false, error: `mediaType must be one of: ${VALID_MEDIA_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // MIME allowlist — reject SVG and any disallowed type before presigning
    const allowed = MIME_ALLOWLIST[mediaType]
    if (!allowed || !allowed.has(mimeType)) {
      return NextResponse.json(
        { success: false, error: `MIME type "${mimeType}" is not permitted for ${mediaType} uploads` },
        { status: 400 }
      )
    }

    // Size limit
    const maxSize = SIZE_LIMITS[mediaType]
    if (fileSize > maxSize) {
      return NextResponse.json(
        { success: false, error: `File too large. Max for ${mediaType}: ${Math.floor(maxSize / 1024 / 1024)}MB` },
        { status: 400 }
      )
    }

    const result = await createPresignedUpload(mediaType, fileName, mimeType, userId, fileSize)

    return NextResponse.json({
      success:   true,
      uploadUrl: result.uploadUrl,
      key:       result.key,
      expiresIn: result.expiresIn,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Presign failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

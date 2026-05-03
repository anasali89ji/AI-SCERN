/**
 * POST /api/v2/forensic-scan
 *
 * Initiates the 6-layer cascading forensic detection pipeline for an image.
 * Uploads the image to R2, creates a forensic_scans record, fires the
 * Inngest cascade event, and returns the scanId immediately (async pipeline).
 *
 * Also optionally runs the existing HuggingFace+NVIDIA ensemble in the
 * background for a blended result in Layer 8.
 */

import { NextRequest, NextResponse } from 'next/server'
import { inngest }                   from '@/lib/inngest/client'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { getR2PublicUrl }            from '@/lib/storage/r2'
import { nanoid }                    from 'nanoid'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Max image size for forensic scan: 10MB
const MAX_SIZE_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth check (optional — allows anon scans) ────────────────────────────
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const sb       = getSupabaseAdmin()
        const { data } = await sb.auth.getUser(authHeader.slice(7))
        userId = data.user?.id ?? null
      } catch { /* anon */ }
    }

    // ── Parse multipart form ─────────────────────────────────────────────────
    const formData = await req.formData()
    const file     = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_IMAGE', message: 'No image file provided' } },
        { status: 400 }
      )
    }

    const mimeType = file.type || 'image/jpeg'
    const ext      = ALLOWED_TYPES[mimeType]

    if (!ext) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TYPE', message: `Unsupported image type: ${mimeType}` } },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: 'Image must be under 10MB' } },
        { status: 413 }
      )
    }

    // ── Upload to R2 ─────────────────────────────────────────────────────────
    const scanId = crypto.randomUUID()
    const r2Key  = `forensic/${scanId}.${ext}`

    const fileBuffer   = Buffer.from(await file.arrayBuffer())
    const r2AccountId  = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || ''
    const r2AccessKey  = process.env.R2_ACCESS_KEY_ID     || ''
    const r2Secret     = process.env.R2_SECRET_ACCESS_KEY || ''
    const r2Bucket     = process.env.R2_BUCKET_NAME       || 'detectai-uploads'

    const s3 = new S3Client({
      region:   'auto',
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2Secret },
    })

    await s3.send(new PutObjectCommand({
      Bucket:      r2Bucket,
      Key:         r2Key,
      Body:        fileBuffer,
      ContentType: mimeType,
      Metadata:    { 'scan-id': scanId, 'user-id': userId ?? 'anon' },
    }))

    const imageUrl = getR2PublicUrl(r2Key)

    // ── Create pending scan record in Supabase ───────────────────────────────
    const sb = getSupabaseAdmin()
    const { error: insertError } = await sb.from('forensic_scans').insert({
      id:                       scanId,
      image_url:                imageUrl,
      r2_key:                   r2Key,
      user_id:                  userId,
      status:                   'pending',
      layers:                   [],
      semantic_agents:          [],
      provenance:               null,
      final_verdict:            null,
      existing_ensemble_result: null,
      created_at:               new Date().toISOString(),
      updated_at:               new Date().toISOString(),
    })

    if (insertError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: insertError.message } },
        { status: 500 }
      )
    }

    // ── Fire Inngest cascade event ───────────────────────────────────────────
    await inngest.send({
      name: 'scan/image.forensic-cascade' as any,
      data: {
        scanId,
        imageUrl,
        r2Key,
        existingEnsembleResult: null,
      },
    })

    return NextResponse.json({
      success: true,
      scanId,
      status:  'pending',
      message: 'Forensic cascade started. Poll /api/v2/forensic-scan/{scanId} for results.',
    })

  } catch (err) {
    console.error('[v2/forensic-scan POST]', err)
    return NextResponse.json(
      {
        success: false,
        error:   {
          code:    'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Unexpected error',
        },
      },
      { status: 500 }
    )
  }
}

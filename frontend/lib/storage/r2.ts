/**
 * Aiscern — Cloudflare R2 Storage Client
 *
 * All file uploads (image, audio, video) go to R2.
 * Supabase is NEVER used for file storage — metadata only.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token (Access Key ID)
 *   R2_SECRET_ACCESS_KEY — R2 API token (Secret)
 *   R2_BUCKET_NAME      — bucket name (e.g. aiscern-uploads)
 *   R2_PUBLIC_URL       — public bucket URL (e.g. https://uploads.aiscern.com)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { nanoid } from 'nanoid'

const R2_ACCOUNT    = process.env.R2_ACCOUNT_ID        || ''
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID     || ''
const R2_SECRET     = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET     = process.env.R2_BUCKET_NAME       || 'aiscern-uploads'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL        || ''

let _client: S3Client | null = null

function getR2Client(): S3Client {
  if (_client) return _client
  if (!R2_ACCOUNT || !R2_ACCESS_KEY || !R2_SECRET) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.')
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET,
    },
  })
  return _client
}

export type R2MediaType = 'image' | 'audio' | 'video'

const ALLOWED_EXTENSIONS: Record<R2MediaType, string[]> = {
  image: ['jpg','jpeg','png','webp','gif','bmp'],
  audio: ['mp3','wav','ogg','flac','m4a','aac','webm'],
  video: ['mp4','mov','avi','mkv','webm','mpeg'],
}

const MAX_SIZES: Record<R2MediaType, number> = {
  image: 10  * 1024 * 1024,  // 10MB
  audio: 25  * 1024 * 1024,  // 25MB
  video: 500 * 1024 * 1024,  // 500MB (R2 can handle it; Vercel never touches the bytes)
}

export interface R2UploadResult {
  key:        string   // R2 object key (path)
  url:        string   // public URL if bucket is public
  size:       number
  mimeType:   string
}

export interface R2PresignedUpload {
  uploadUrl: string   // PUT to this URL directly from browser
  key:       string   // keep this — pass to detection API
  expiresIn: number   // seconds
}

/**
 * Generate a presigned PUT URL for direct browser → R2 upload.
 * The browser uploads directly; Vercel never receives the bytes.
 */
export async function createPresignedUpload(
  mediaType: R2MediaType,
  fileName:  string,
  mimeType:  string,
  userId:    string,
  fileSize:  number,
): Promise<R2PresignedUpload> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

  if (!ALLOWED_EXTENSIONS[mediaType].includes(ext)) {
    throw new Error(`File type .${ext} not allowed for ${mediaType} uploads.`)
  }
  if (fileSize > MAX_SIZES[mediaType]) {
    throw new Error(`File too large. Max ${MAX_SIZES[mediaType] / 1024 / 1024}MB for ${mediaType}.`)
  }

  // key: uploads/{mediaType}/{userId}/{timestamp}-{random}.{ext}
  const key = `uploads/${mediaType}/${userId}/${Date.now()}-${nanoid(8)}.${ext}`

  const cmd = new PutObjectCommand({
    Bucket:        R2_BUCKET,
    Key:           key,
    ContentType:   mimeType,
    ContentLength: fileSize,
    Metadata: {
      'user-id':    userId,
      'media-type': mediaType,
      'original':   encodeURIComponent(fileName),
    },
  })

  const uploadUrl = await getSignedUrl(getR2Client(), cmd, { expiresIn: 3600 })

  return { uploadUrl, key, expiresIn: 3600 }
}

/**
 * Stream an object from R2 back to the server (for ML inference).
 * Only used when the detection route needs the raw bytes.
 * For large files, prefer streaming directly — don't buffer to memory.
 */
export async function getR2Object(key: string): Promise<{
  stream: ReadableStream
  contentType: string
  contentLength: number
}> {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  const res = await getR2Client().send(cmd) as any

  if (!res.Body) throw new Error(`R2 object not found: ${key}`)

  return {
    stream:        res.Body as unknown as ReadableStream,
    contentType:   res.ContentType ?? 'application/octet-stream',
    contentLength: res.ContentLength ?? 0,
  }
}

/**
 * Get R2 object as Buffer (for ML inference — small files only).
 * For audio/image (<25MB). Do NOT use for video.
 */
export async function getR2Buffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  const res = await getR2Client().send(cmd) as any

  if (!res.Body) throw new Error(`R2 object not found: ${key}`)

  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return {
    buffer:      Buffer.concat(chunks),
    contentType: res.ContentType ?? 'application/octet-stream',
  }
}

/**
 * Check if a key exists in R2 without downloading it.
 */
export async function r2KeyExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

/**
 * Delete an object from R2 (called after scan completes, optional retention policy).
 */
export async function deleteR2Object(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}

/**
 * Get the public URL for an R2 object.
 * Only works if the bucket has public access enabled.
 */
export function getR2PublicUrl(key: string): string {
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
  return `https://${R2_ACCOUNT}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`
}

/**
 * Quick availability check — returns true if R2 env vars are set.
 */
export function r2Available(): boolean {
  return !!(R2_ACCOUNT && R2_ACCESS_KEY && R2_SECRET)
}

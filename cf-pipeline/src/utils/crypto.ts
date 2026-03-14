/**
 * Crypto utilities — SHA-256 hashing for content dedup + shard integrity
 */

export async function sha256(text: string): Promise<string> {
  const buf    = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** SHA-256 of raw binary content (for shard file integrity) */
export async function sha256Bytes(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Base64-encode a UTF-8 string.
 * Uses TextEncoder + Uint8Array → avoids deprecated unescape() which is
 * unreliable for non-ASCII content in Cloudflare Workers.
 */
export function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary  = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Shard filename: part-0001.jsonl */
export function shardFilename(partNum: number): string {
  return `part-${String(partNum).padStart(4, '0')}.jsonl`
}

/** HF dataset path: data/{media_type}/{language}/part-0001.jsonl */
export function hfShardPath(mediaType: string, language: string, partNum: number): string {
  return `data/${mediaType}/${language}/${shardFilename(partNum)}`
}

/** HF shard metadata path: data/{media_type}/{language}/part-0001.meta.json */
export function hfMetaPath(mediaType: string, language: string, partNum: number): string {
  return `data/${mediaType}/${language}/part-${String(partNum).padStart(4, '0')}.meta.json`
}

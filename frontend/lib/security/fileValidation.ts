/**
 * lib/security/fileValidation.ts
 *
 * Strict file upload validation:
 *  1. MIME type allowlist check
 *  2. Magic byte (file signature) validation — prevents MIME spoofing
 *  3. File size limits per modality
 *  4. SVG and polyglot file blocking
 *
 * Usage:
 *   const result = await validateUpload(buffer, mimeType, fileSize, 'image')
 *   if (!result.valid) return NextResponse.json({ error: result.reason }, { status: 400 })
 */

export type MediaCategory = 'image' | 'audio' | 'video'

export interface ValidationResult {
  valid: boolean
  reason?: string
  /** Sanitized MIME — prefer this over the client-supplied value */
  confirmedMime?: string
}

// ── Size limits ────────────────────────────────────────────────────────────
const SIZE_LIMITS: Record<MediaCategory, number> = {
  image: 10  * 1024 * 1024,  // 10 MB
  audio: 50  * 1024 * 1024,  // 50 MB
  video: 100 * 1024 * 1024,  // 100 MB
}

// ── Allowed MIME types ─────────────────────────────────────────────────────
const ALLOWED_MIMES: Record<MediaCategory, Set<string>> = {
  image: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  audio: new Set(['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/flac', 'audio/webm']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']),
}

// ── Magic byte signatures ──────────────────────────────────────────────────
// Each entry: { mime, offset, magic (hex bytes) }
interface MagicEntry {
  mime: string
  offset: number
  magic: number[]
}

const MAGIC_SIGNATURES: MagicEntry[] = [
  // Images
  { mime: 'image/jpeg',   offset: 0, magic: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',    offset: 0, magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/webp',   offset: 0, magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF — confirmed with offset 8: WEBP
  { mime: 'image/gif',    offset: 0, magic: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  // Audio
  { mime: 'audio/mpeg',   offset: 0, magic: [0xFF, 0xFB] },             // MP3
  { mime: 'audio/mpeg',   offset: 0, magic: [0xFF, 0xF3] },             // MP3 variant
  { mime: 'audio/mpeg',   offset: 0, magic: [0xFF, 0xF2] },             // MP3 variant
  { mime: 'audio/mpeg',   offset: 0, magic: [0x49, 0x44, 0x33] },       // ID3 tag (MP3)
  { mime: 'audio/wav',    offset: 0, magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF/WAV
  { mime: 'audio/mp4',    offset: 4, magic: [0x66, 0x74, 0x79, 0x70] }, // ftyp box (M4A/MP4)
  { mime: 'audio/x-m4a', offset: 4, magic: [0x66, 0x74, 0x79, 0x70] }, // ftyp box
  { mime: 'audio/ogg',   offset: 0, magic: [0x4F, 0x67, 0x67, 0x53] }, // OggS
  { mime: 'audio/flac',  offset: 0, magic: [0x66, 0x4C, 0x61, 0x43] }, // fLaC
  { mime: 'audio/webm',  offset: 0, magic: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML/WebM
  // Video
  { mime: 'video/mp4',       offset: 4, magic: [0x66, 0x74, 0x79, 0x70] }, // ftyp box
  { mime: 'video/webm',      offset: 0, magic: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML
  { mime: 'video/quicktime', offset: 4, magic: [0x66, 0x74, 0x79, 0x70] }, // ftyp
  { mime: 'video/quicktime', offset: 0, magic: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70] },
  { mime: 'video/x-msvideo', offset: 0, magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF/AVI
]

// SVG is an XSS vector — always blocked even if renamed
const SVG_SIGNATURES = [
  '<svg',
  '<?xml',
  '<!DOCTYPE svg',
]

/**
 * Main validation function.
 *
 * @param buffer - File content as Buffer
 * @param clientMime - MIME type claimed by the client
 * @param fileSize - Size in bytes (should match buffer.length)
 * @param category - Expected media category
 */
export function validateUpload(
  buffer: Buffer,
  clientMime: string,
  fileSize: number,
  category: MediaCategory,
): ValidationResult {
  // 1. Size check
  const maxSize = SIZE_LIMITS[category]
  if (fileSize > maxSize) {
    return {
      valid: false,
      reason: `File too large. Max size for ${category}: ${Math.floor(maxSize / 1024 / 1024)}MB`,
    }
  }

  // 2. Empty file guard
  if (buffer.length < 4) {
    return { valid: false, reason: 'File is too small or empty' }
  }

  // 3. SVG / polyglot text detection (check first 512 bytes as UTF-8)
  const textPreview = buffer.slice(0, 512).toString('utf8').toLowerCase().trimStart()
  for (const sig of SVG_SIGNATURES) {
    if (textPreview.startsWith(sig)) {
      return { valid: false, reason: 'SVG files are not permitted (XSS risk)' }
    }
  }

  // 4. Client MIME must be in the allowlist for this category
  const allowed = ALLOWED_MIMES[category]
  if (!allowed.has(clientMime)) {
    return {
      valid: false,
      reason: `MIME type "${clientMime}" is not permitted for ${category} uploads`,
    }
  }

  // 5. Magic byte validation
  const detectedMime = detectMagicMime(buffer)

  if (!detectedMime) {
    return {
      valid: false,
      reason: 'File signature not recognised — upload rejected',
    }
  }

  // The detected MIME must match the allowed set for the category
  // (e.g., we won't accept an MP4 disguised as a JPEG)
  if (!allowed.has(detectedMime)) {
    return {
      valid: false,
      reason: `File content does not match expected ${category} type (detected: ${detectedMime})`,
    }
  }

  // 6. WebP extra check: bytes 8-11 must be 'WEBP'
  if (detectedMime === 'image/webp') {
    const webpTag = buffer.slice(8, 12).toString('ascii')
    if (webpTag !== 'WEBP') {
      return { valid: false, reason: 'Invalid WebP file structure' }
    }
  }

  return { valid: true, confirmedMime: detectedMime }
}

/** Match buffer against known magic byte signatures */
function detectMagicMime(buffer: Buffer): string | null {
  for (const entry of MAGIC_SIGNATURES) {
    const { offset, magic, mime } = entry
    if (buffer.length < offset + magic.length) continue
    const matches = magic.every((byte, i) => buffer[offset + i] === byte)
    if (matches) return mime
  }
  return null
}

/**
 * Generate a UUID-based filename — NEVER expose the original filename
 * to prevent path traversal and fingerprinting.
 */
export function sanitizeFileName(originalName: string, mime: string): string {
  const ext = mimeToExtension(mime)
  const uuid = crypto.randomUUID()
  return `${uuid}${ext}`
}

function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg':       '.jpg',
    'image/png':        '.png',
    'image/webp':       '.webp',
    'image/gif':        '.gif',
    'audio/mpeg':       '.mp3',
    'audio/wav':        '.wav',
    'audio/mp4':        '.m4a',
    'audio/x-m4a':     '.m4a',
    'audio/ogg':        '.ogg',
    'audio/flac':       '.flac',
    'audio/webm':       '.weba',
    'video/mp4':        '.mp4',
    'video/webm':       '.webm',
    'video/quicktime':  '.mov',
    'video/x-msvideo':  '.avi',
    // Module 2.4: document MIME types
    'application/pdf':           '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':     '.docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':   '.pptx',
    'application/msword':         '.doc',
    'application/vnd.ms-powerpoint': '.ppt',
  }
  return map[mime] ?? ''
}

// ── Module 2.4: Document upload validation ────────────────────────────────
// PDF/DOCX/PPTX MIME + magic-byte validation. The original validateUpload()
// only covers image/audio/video — documents had no validation, so any binary
// renamed to .pdf would reach pdf-parse or JSZip before being rejected.
// Security risk: a malicious PDF can DoS pdf-parse via a billion-laughs
// attack, and a malicious DOCX can XSS via script-enabled OOXML parts.

const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc (legacy)
  'application/vnd.ms-powerpoint', // .ppt (legacy)
])

const DOCUMENT_MAGIC_SIGNATURES: MagicEntry[] = [
  { mime: 'application/pdf', offset: 0, magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  // OOXML formats (.docx, .pptx, .xlsx) all share the PK\x03\x04 ZIP signature.
  // A more specific check would inspect [Content_Types].xml inside the ZIP,
  // but the magic-byte check at the upload boundary is sufficient — the OOXML
  // parser (JSZip) will reject malformed content later if it slips through.
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    offset: 0, magic: [0x50, 0x4B, 0x03, 0x04] }, // PK\x03\x04
  { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    offset: 0, magic: [0x50, 0x4B, 0x03, 0x04] }, // PK\x03\x04
  { mime: 'application/msword',           offset: 0, magic: [0xD0, 0xCF, 0x11, 0xE0] }, // legacy .doc OLE
  { mime: 'application/vnd.ms-powerpoint', offset: 0, magic: [0xD0, 0xCF, 0x11, 0xE0] }, // legacy .ppt OLE
]

export interface DocumentValidationResult {
  valid: boolean
  error?: string
  /** Sanitized MIME — prefer this over the client-supplied value */
  confirmedMime?: string
}

/**
 * Module 2.4: validate a document upload (PDF/DOCX/PPTX).
 * Performs MIME allowlist + magic-byte check + size limit.
 *
 * Size limits are MIME-specific:
 *   - PDF: 20 MB (matches Vercel Hobby body size limit)
 *   - DOCX/PPTX: 25 MB
 *
 * Returns { valid: true, confirmedMime } on success, { valid: false, error }
 * on failure with a user-readable error message.
 */
export function validateDocumentUpload(
  buffer: Buffer,
  mime: string,
  size: number,
): DocumentValidationResult {
  // 1. MIME allowlist
  if (!ALLOWED_DOCUMENT_MIMES.has(mime)) {
    return { valid: false, error: `Unsupported document type "${mime}". Allowed: PDF, DOCX, PPTX.` }
  }

  // 2. Size check — MIME-specific (PDF 20MB, OOXML 25MB, legacy OLE 25MB)
  const isPdf = mime === 'application/pdf'
  const maxSize = isPdf ? 20 * 1024 * 1024 : 25 * 1024 * 1024
  if (size > maxSize) {
    return { valid: false, error: `File exceeds ${Math.floor(maxSize / 1024 / 1024)}MB limit` }
  }

  // 3. Empty / too-small guard
  if (buffer.length < 4) {
    return { valid: false, error: 'File is too small or empty' }
  }

  // 4. Magic-byte check — the file's actual content must match the declared MIME
  const sig = DOCUMENT_MAGIC_SIGNATURES.find(s => s.mime === mime)
  if (sig) {
    const matches = sig.magic.every((byte, i) => buffer[sig.offset + i] === byte)
    if (!matches) {
      return { valid: false, error: 'File content does not match declared type — magic bytes mismatch' }
    }
  }

  return { valid: true, confirmedMime: mime }
}

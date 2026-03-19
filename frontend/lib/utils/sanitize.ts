/**
 * Input sanitization utilities — security hardening
 */

/** Strip HTML tags and dangerous characters from text input */
export function sanitizeText(input: string, maxLength = 50000): string {
  return input
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/javascript:/gi, '')       // strip JS protocol
    .replace(/on\w+\s*=/gi, '')         // strip event handlers
    .slice(0, maxLength)                // enforce max length
    .trim()
}

/** Validate and sanitize a URL */
export function sanitizeUrl(input: string): string | null {
  try {
    const url = new URL(input.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Validate file type against allowed list */
export function validateFileType(file: File, allowed: string[]): boolean {
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
  return allowed.includes(ext) || allowed.some(a => file.type.startsWith(a.replace('.*', '')))
}

/** Sanitize filename */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-\s]/g, '_').slice(0, 255)
}

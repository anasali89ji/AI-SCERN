/**
 * Aiscern — Image Preprocessing (Module 5.1)
 *
 * Normalises images before ML inference:
 *   - Resize to max 1024×1024 (preserving aspect ratio)
 *   - Convert to JPEG at 92% quality for consistent entropy signal
 *   - Strip EXIF metadata (prevents bias in EXIF-based signals)
 *
 * ViT/CNN models resize to 224×224 internally anyway — sending
 * 20MP images wastes bandwidth and can exceed HF's 10MB limit.
 * sharp is lazy-loaded so this is safe in the Next.js App Router.
 */

export interface PreprocessResult {
  buffer:        Buffer
  mimeType:      string
  originalSize:  number
  processedSize: number
  wasResized:    boolean
}

export async function preprocessImage(
  buffer:   Buffer,
  mimeType: string,
): Promise<PreprocessResult> {
  const originalSize = buffer.length

  // Skip non-image or SVG (sharp can't process SVG safely)
  if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
    return { buffer, mimeType, originalSize, processedSize: originalSize, wasResized: false }
  }

  try {
    const mod   = await import('sharp')
    const sharp = mod.default

    const processed = await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92, progressive: false, mozjpeg: false })
      .withMetadata({ exif: {} })   // strip all EXIF
      .toBuffer()

    return {
      buffer:        processed,
      mimeType:      'image/jpeg',
      originalSize,
      processedSize: processed.length,
      wasResized:    processed.length < originalSize || !mimeType.includes('jpeg'),
    }
  } catch {
    // sharp unavailable (edge runtime) or processing error — return original unchanged
    return { buffer, mimeType, originalSize, processedSize: originalSize, wasResized: false }
  }
}

/**
 * Aiscern — Perceptual Hash ("Synth ID") for durable image fingerprinting
 *
 * Problem this solves: `contentHash()` in lib/cache/detection-cache.ts is an
 * exact-byte SHA-256 of the first 64KB, cached in Redis for 1 hour — it only
 * matches a byte-identical re-upload. It cannot recognize "this is the same
 * photo, just re-saved as a JPEG at a different quality" or "cropped" or
 * "resized" — which is exactly what a re-upload years later usually looks
 * like (screenshotted, re-shared, re-compressed by another platform, etc).
 *
 * This module computes a classic 64-bit DCT perceptual hash:
 *   1. Decode to grayscale, resize to 32x32 (kills high-frequency noise from
 *      recompression).
 *   2. Run a 2D DCT.
 *   3. Keep the top-left 8x8 low-frequency block (excluding the DC term).
 *   4. Threshold each coefficient against the median -> 64 bits.
 *
 * Two images of the same underlying source, even after resize/recompress/
 * mild crop, produce hashes with a small Hamming distance (typically <= 10
 * out of 64 bits). Two unrelated images produce hashes with a distance
 * close to 32 (random). We treat distance <= 10 as "likely the same source
 * image" — see HAMMING_MATCH_THRESHOLD below.
 *
 * The hash is stored both as hex text (`scans.perceptual_hash`) and as a
 * signed bigint (`scans.phash_int`) so Postgres can do a cheap prefilter;
 * MotherDuck (lib/motherduck/archive.ts) does the full historical search
 * since that's where scans live long-term after Supabase's retention purge.
 */
import sharp from 'sharp'

export const HAMMING_MATCH_THRESHOLD = 10 // out of 64 bits — tune based on false-positive rate in production

const HASH_SIZE = 32 // decode/resize target (32x32 grayscale)
const LOW_FREQ  = 8  // keep top-left 8x8 DCT block

/** 1D DCT-II, used twice (rows then columns) for the 2D DCT. */
function dct1d(input: Float64Array): Float64Array {
  const n = input.length
  const out = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += input[i] * Math.cos((Math.PI / n) * (i + 0.5) * k)
    }
    out[k] = sum * (k === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n))
  }
  return out
}

function dct2d(matrix: Float64Array[], size: number): Float64Array[] {
  // Rows
  const rowsTransformed = matrix.map(row => dct1d(row))
  // Columns
  const cols: Float64Array[] = []
  for (let x = 0; x < size; x++) {
    const col = new Float64Array(size)
    for (let y = 0; y < size; y++) col[y] = rowsTransformed[y][x]
    cols.push(dct1d(col))
  }
  const out: Float64Array[] = Array.from({ length: size }, () => new Float64Array(size))
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      out[y][x] = cols[x][y]
    }
  }
  return out
}

export interface PerceptualHashResult {
  hex: string    // 16 hex chars = 64 bits
  bigint: bigint // signed 64-bit representation for DB storage (Postgres BIGINT)
}

/**
 * Compute the 64-bit DCT perceptual hash of an image buffer.
 * Returns null if the image can't be decoded (corrupt file, unsupported format, etc)
 * — callers should treat this as "no fingerprint available", not throw.
 */
export async function computePerceptualHash(buffer: Buffer): Promise<PerceptualHashResult | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    if (info.width !== HASH_SIZE || info.height !== HASH_SIZE) return null

    const matrix: Float64Array[] = []
    for (let y = 0; y < HASH_SIZE; y++) {
      const row = new Float64Array(HASH_SIZE)
      for (let x = 0; x < HASH_SIZE; x++) {
        row[x] = data[y * HASH_SIZE + x]
      }
      matrix.push(row)
    }

    const dct = dct2d(matrix, HASH_SIZE)

    // Low-frequency block, excluding the DC term (dct[0][0]) which just
    // encodes average brightness and isn't discriminative.
    const coeffs: number[] = []
    for (let y = 0; y < LOW_FREQ; y++) {
      for (let x = 0; x < LOW_FREQ; x++) {
        if (x === 0 && y === 0) continue
        coeffs.push(dct[y][x])
      }
    }

    const sorted = [...coeffs].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    let bits = BigInt(0)
    for (let i = 0; i < coeffs.length && i < 64; i++) {
      bits <<= BigInt(1)
      if (coeffs[i] > median) bits |= BigInt(1)
    }
    // Pad to exactly 64 bits if coeffs.length < 64 (LOW_FREQ=8 -> 63 coeffs after dropping DC)
    const padBits = 64 - coeffs.length
    if (padBits > 0) bits <<= BigInt(padBits)

    const hex = bits.toString(16).padStart(16, '0')
    const bigintSigned = BigInt.asIntN(64, bits) // Postgres BIGINT is signed 64-bit

    return { hex, bigint: bigintSigned }
  } catch {
    return null // corrupt/unsupported image — non-fatal, caller proceeds without a fingerprint
  }
}

/** Hamming distance between two hex-encoded 64-bit hashes. */
export function hammingDistanceHex(hexA: string, hexB: string): number {
  const a = BigInt('0x' + hexA)
  const b = BigInt('0x' + hexB)
  let xor = a ^ b
  let count = 0
  while (xor > BigInt(0)) {
    count += Number(xor & BigInt(1))
    xor >>= BigInt(1)
  }
  return count
}

/** True if two hashes are close enough to be considered "the same source image." */
export function isLikelyMatch(hexA: string, hexB: string, threshold = HAMMING_MATCH_THRESHOLD): boolean {
  return hammingDistanceHex(hexA, hexB) <= threshold
}

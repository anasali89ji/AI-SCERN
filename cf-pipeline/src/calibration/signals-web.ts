/**
 * DETECTAI Calibration — Pixel Signal Extractors (CF Workers / Web API compatible)
 * No Node.js Buffer — uses Uint8Array + Web APIs only.
 */

export interface SignalSet {
  entropy:      number
  noise:        number
  luminance:    number
  background:   number
  colorBalance: number
  compression:  number
}

function findPixelStart(bytes: Uint8Array): number {
  let i = 2
  while (i < bytes.length - 4) {
    const marker = (bytes[i] << 8) | bytes[i + 1]
    const len    = (bytes[i + 2] << 8) | bytes[i + 3]
    if (marker === 0xFFDA) return i + 4
    if ((marker >= 0xFFE0 && marker <= 0xFFEF) ||
        marker === 0xFFFE || marker === 0xFFDB ||
        marker === 0xFFC0 || marker === 0xFFC4) {
      i += 2 + len; continue
    }
    i += 2
  }
  return Math.floor(bytes.length * 0.3)
}

function sample(bytes: Uint8Array, count = 2000): number[] {
  const start = findPixelStart(bytes)
  const end   = bytes.length - 2
  const range = end - start
  if (range <= 0) return []
  const step  = Math.max(1, Math.floor(range / count))
  const out: number[] = []
  for (let i = start; i < end && out.length < count; i += step) out.push(bytes[i])
  return out
}

function entropy(s: number[]): number {
  if (!s.length) return 7.0
  const freq = new Array(256).fill(0)
  for (const b of s) freq[b]++
  let h = 0
  for (const f of freq) {
    if (f > 0) { const p = f / s.length; h -= p * Math.log2(p) }
  }
  return h
}

function noiseLevel(s: number[]): number {
  if (s.length < 2) return 10
  let d = 0
  for (let i = 1; i < s.length; i++) d += Math.abs(s[i] - s[i-1])
  return d / (s.length - 1)
}

function midtoneFraction(s: number[]): number {
  if (!s.length) return 0.6
  return s.filter(b => b >= 80 && b <= 210).length / s.length
}

function bgStdDev(bytes: Uint8Array): number {
  const start = findPixelStart(bytes)
  const end   = start + Math.floor((bytes.length - start) * 0.10)
  const bg: number[] = []
  const step  = Math.max(1, Math.floor((end - start) / 300))
  for (let i = start; i < end; i += step) bg.push(bytes[i])
  if (!bg.length) return 25
  const mean = bg.reduce((a, b) => a + b, 0) / bg.length
  return Math.sqrt(bg.reduce((a, b) => a + (b - mean) ** 2, 0) / bg.length)
}

function colorDev(bytes: Uint8Array): number {
  const start = findPixelStart(bytes)
  const end   = bytes.length - 2
  const step  = Math.max(3, Math.floor((end - start) / 600))
  let r = 0, g = 0, b = 0, n = 0
  for (let i = start; i < end - 2 && n < 600; i += step) {
    r += bytes[i]; g += bytes[i+1]; b += bytes[i+2]; n++
  }
  if (!n) return 0.07
  const total = r + g + b
  if (!total) return 0.07
  return Math.abs(r/total - 0.333) + Math.abs(g/total - 0.333) + Math.abs(b/total - 0.333)
}

export function computeSignals(bytes: Uint8Array, fileSize: number): SignalSet {
  const s = sample(bytes, 2000)
  return {
    entropy:      entropy(s),
    noise:        noiseLevel(s),
    luminance:    midtoneFraction(s),
    background:   bgStdDev(bytes),
    colorBalance: colorDev(bytes),
    compression:  fileSize,
  }
}

/**
 * Decode base64 string to Uint8Array (CF Workers compatible)
 * Handles both plain base64 and data URLs (data:image/jpeg;base64,...)
 */
function base64ToBytes(b64: string): Uint8Array {
  // Strip data URL prefix if present: data:image/jpeg;base64,XXXX
  const comma = b64.indexOf(',')
  const raw   = comma >= 0 ? b64.slice(comma + 1) : b64
  const binary = atob(raw)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Fetch an image from a plain HTTP/HTTPS URL and compute signals */
export async function signalsFromUrl(url: string, hfToken?: string): Promise<SignalSet | null> {
  try {
    if (!url.startsWith('http')) return null  // reject data: and other non-HTTP URLs
    const headers: Record<string,string> = { 'User-Agent': 'DETECTAI-Cal/1.0' }
    if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return computeSignals(new Uint8Array(buf), buf.byteLength)
  } catch { return null }
}

/**
 * Fetch a HuggingFace dataset row's image and compute signals.
 *
 * The HF Datasets Server API returns images in one of these formats:
 *   1. { src: "data:image/jpeg;base64,..." }  ← most common (can't fetch, decode directly)
 *   2. { bytes: <array>, path: "..." }         ← binary bytes
 *   3. "https://..."                            ← direct URL (can fetch)
 *   4. { url: "https://..." }                  ← URL field
 *
 * CF Workers cannot fetch() data: URLs, so we decode base64 directly.
 */
export async function signalsFromHFDataset(
  dataset: string, config: string, split: string,
  offset: number, hfToken: string,
  imageField = 'image', urlField?: string,
): Promise<SignalSet | null> {
  try {
    const apiUrl = [
      'https://datasets-server.huggingface.co/rows',
      `?dataset=${encodeURIComponent(dataset)}`,
      `&config=${encodeURIComponent(config)}`,
      `&split=${encodeURIComponent(split)}`,
      `&offset=${offset}&length=1`,
    ].join('')

    const res = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${hfToken}`, 'User-Agent': 'DETECTAI-Cal/1.0' },
      signal:  AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null

    const data = await res.json() as { rows: { row: Record<string,any> }[] }
    const row  = data.rows?.[0]?.row
    if (!row) return null

    // ── Try URL field first (Unsplash, Midjourney, etc.) ──────────────────
    if (urlField && typeof row[urlField] === 'string' && row[urlField].startsWith('http')) {
      return signalsFromUrl(row[urlField], hfToken)
    }

    // ── Try image field ───────────────────────────────────────────────────
    const img = row[imageField]
    if (!img) return null

    // Case 1: plain string URL
    if (typeof img === 'string') {
      if (img.startsWith('http')) return signalsFromUrl(img, hfToken)
      if (img.startsWith('data:')) {
        // data URL — decode base64 directly (CF Workers can't fetch data: URLs)
        const bytes = base64ToBytes(img)
        return computeSignals(bytes, bytes.length)
      }
    }

    // Case 2: object with src (HF Datasets Server most common format)
    if (img && typeof img === 'object') {
      // src field (usually a data URL from HF Datasets API)
      if (typeof img.src === 'string') {
        if (img.src.startsWith('data:')) {
          const bytes = base64ToBytes(img.src)
          return computeSignals(bytes, bytes.length)
        }
        if (img.src.startsWith('http')) return signalsFromUrl(img.src, hfToken)
      }
      // url field
      if (typeof img.url === 'string' && img.url.startsWith('http')) {
        return signalsFromUrl(img.url, hfToken)
      }
      // bytes field (array of integers)
      if (Array.isArray(img.bytes) && img.bytes.length > 0) {
        const bytes = new Uint8Array(img.bytes)
        return computeSignals(bytes, bytes.length)
      }
      // path field (sometimes a relative path — try fetching as HF CDN URL)
      if (typeof img.path === 'string' && img.path.length > 0) {
        const cdnUrl = `https://huggingface.co/datasets/${dataset}/resolve/main/${img.path}`
        return signalsFromUrl(cdnUrl, hfToken)
      }
    }

    return null
  } catch { return null }
}

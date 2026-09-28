/**
 * HuggingFace Datasets Server API client
 * v8: 429 retry-after THEN retry, per-worker jitter, 15s timeout, dead-source skip
 */

const HF_DATASETS_API = 'https://datasets-server.huggingface.co'
const MAX_HF_LENGTH   = 100

// Sources that are permanently dead — skip immediately, never even attempt
export const DEAD_SOURCES = new Set([
  'truthfulqa-human',  // HF 404 — dataset moved/removed (4547 errors)
  'yelp-reviews',      // HF 404 — dataset removed (4182 errors)
  'airoboros',         // Consistent timeout, 0 inserts (256 errors)
  'ghostbuster',       // private/inaccessible
  'raid-benchmark',    // removed
])

// Sources with excessive errors get a cooldown — checked via cursor table
export const MAX_ERRORS_BEFORE_COOLDOWN = 600

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4, baseMs = 800): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn() }
    catch (err: any) {
      lastError = err
      if (attempt < maxAttempts) {
        // Exponential backoff with jitter
        const delay = Math.min(baseMs * Math.pow(2, attempt - 1) + Math.random() * 200, 8000)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

export interface HFRow { row_idx: number; row: Record<string, any> }
export interface HFRowsResponse { rows: HFRow[] }

function buildUrl(dataset: string, config: string, split: string, offset: number, length: number): string {
  return `${HF_DATASETS_API}/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${length}`
}

export async function fetchHFRows(
  dataset:  string,
  config  = 'default',
  split   = 'train',
  offset  = 0,
  length  = MAX_HF_LENGTH,
  hfToken?: string,
): Promise<HFRowsResponse> {
  const headers: Record<string, string> = { 'User-Agent': 'Aiscern-Pipeline/8.0' }
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`

  return withRetry(async () => {
    let url = buildUrl(dataset, config, split, offset, Math.min(length, MAX_HF_LENGTH))
    // Reduced timeout: 15s (was 25s) — fail fast, move to next source
    let res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })

    if ((res.status === 400 || res.status === 416) && offset > 0) {
      url = buildUrl(dataset, config, split, 0, Math.min(length, MAX_HF_LENGTH))
      res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
    }

    if (res.status === 429) {
      // KEY FIX: wait for Retry-After, then RETRY (not throw)
      const waitSec = parseInt(res.headers.get('Retry-After') ?? '10')
      const waitMs  = Math.min(waitSec * 1000, 30_000) // cap at 30s
      await new Promise(r => setTimeout(r, waitMs))
      // Throw to trigger withRetry's next attempt (will retry after backoff)
      throw new Error(`Rate limited: ${dataset}`)
    }
    if (res.status === 401 || res.status === 403)
      throw new Error(`GATED:${res.status} — ${dataset}`)
    if (res.status === 404)
      throw new Error(`DEAD:404 — ${dataset} (dataset does not exist)`)
    if (!res.ok)
      throw new Error(`HF ${res.status} for ${dataset}: ${(await res.text().catch(() => '')).slice(0, 100)}`)

    return res.json() as Promise<HFRowsResponse>
  }, 4, 800)
}

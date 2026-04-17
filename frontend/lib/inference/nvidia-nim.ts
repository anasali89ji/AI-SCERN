/**
 * Aiscern — NVIDIA NIM Vision Client
 * Uses meta/llama-3.2-11b-vision-instruct for per-frame deepfake analysis.
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 */

const NIM_API   = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NIM_KEY   = process.env.NVIDIA_API_KEY ?? ''
const NIM_MODEL = 'meta/llama-3.2-11b-vision-instruct'

export interface NIMFrameResult {
  frame_index:  number
  time_sec:     number
  ai_score:     number          // 0–1
  face_detected: boolean
  signals:      string[]
  reason:       string
  raw_confidence: number        // 0–100 as returned by model
}

export interface NIMVideoResult {
  frames:               NIMFrameResult[]
  temporal_consistency: number   // 0–1, lower = more inconsistent = more suspicious
  face_present_ratio:   number   // fraction of frames with a face
  mean_score:           number
  max_score:            number
  min_score:            number
  model:                string
}

// Prompt engineered for maximum accuracy with minimal token use
const FRAME_PROMPT = `Analyze this video frame for signs of deepfake or AI generation.
Focus on: face boundaries, skin texture, eye reflections, hair detail, background coherence.
Respond ONLY with valid JSON, no explanation outside it:
{"is_deepfake":boolean,"confidence":0-100,"face_detected":boolean,"signals":["signal1","signal2"],"reason":"1 sentence"}`

async function analyzeFrame(
  base64Jpeg: string,
  frameIndex: number,
  timeSec: number,
): Promise<NIMFrameResult> {
  const payload = {
    model:       NIM_MODEL,
    messages: [{
      role:    'user',
      content: [
        {
          type:      'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` },
        },
        { type: 'text', text: FRAME_PROMPT },
      ],
    }],
    max_tokens:  200,
    temperature: 0.05,   // near-deterministic
  }

  const res = await fetch(NIM_API, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${NIM_KEY}`,
      'Content-Type':  'application/json',
    },
    body:   JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`NVIDIA NIM ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
  }

  const content = data.choices?.[0]?.message?.content ?? '{}'

  // Strip markdown fences if model wrapped JSON
  const clean = content.replace(/```json\n?|\n?```/g, '').trim()

  let parsed: {
    is_deepfake: boolean
    confidence:  number
    face_detected: boolean
    signals:     string[]
    reason:      string
  }

  try {
    parsed = JSON.parse(clean)
  } catch {
    // If JSON parse fails, extract confidence with regex fallback
    const confMatch = clean.match(/"confidence"\s*:\s*(\d+)/)
    const fakeMatch = clean.match(/"is_deepfake"\s*:\s*(true|false)/)
    parsed = {
      is_deepfake:   fakeMatch?.[1] === 'true' ?? false,
      confidence:    confMatch ? parseInt(confMatch[1]) : 50,
      face_detected: /face/i.test(clean),
      signals:       [],
      reason:        clean.slice(0, 100),
    }
  }

  const rawConf = Math.max(0, Math.min(100, parsed.confidence ?? 50))
  // Convert to 0–1 AI score: if deepfake, score = conf/100, else score = 1 - conf/100
  const aiScore = parsed.is_deepfake
    ? rawConf / 100
    : 1 - (rawConf / 100)

  return {
    frame_index:    frameIndex,
    time_sec:       timeSec,
    ai_score:       Math.round(aiScore * 1000) / 1000,
    face_detected:  parsed.face_detected ?? false,
    signals:        parsed.signals ?? [],
    reason:         parsed.reason ?? '',
    raw_confidence: rawConf,
  }
}

/**
 * Analyze multiple video frames in parallel.
 * frames: array of { base64: string, index: number, timeSec: number }
 */
export async function analyzeVideoFrames(
  frames: { base64: string; index: number; timeSec: number }[],
): Promise<NIMVideoResult> {
  if (!NIM_KEY) throw new Error('NVIDIA_API_KEY not configured')
  if (!frames.length) throw new Error('No frames provided')

  try {
  // Run all frames in parallel (6 frames = 6 NIM calls)
  const results = await Promise.allSettled(
    frames.map(f => analyzeFrame(f.base64, f.index, f.timeSec))
  )

  const successful: NIMFrameResult[] = results
    .filter((r): r is PromiseFulfilledResult<NIMFrameResult> => r.status === 'fulfilled')
    .map(r => r.value)

  // If all failed, throw
  if (!successful.length) {
    const firstErr = results.find(r => r.status === 'rejected') as PromiseRejectedResult
    throw new Error(firstErr?.reason?.message ?? 'All frame analyses failed')
  }

  const scores = successful.map(f => f.ai_score)
  const mean   = scores.reduce((a, b) => a + b, 0) / scores.length

  // Temporal consistency: low variance = consistent = less suspicious
  // High variance = frames disagree = suspicious (inconsistent deepfake)
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length
  const stdDev   = Math.sqrt(variance)
  // Normalize: stdDev > 0.3 = very inconsistent, < 0.05 = very consistent
  const temporalConsistency = Math.max(0, Math.min(1, 1 - (stdDev / 0.3)))

  const facePresentRatio = successful.filter(f => f.face_detected).length / successful.length

  return {
    frames:               successful,
    temporal_consistency: Math.round(temporalConsistency * 1000) / 1000,
    face_present_ratio:   Math.round(facePresentRatio * 1000) / 1000,
    mean_score:           Math.round(mean * 1000) / 1000,
    max_score:            Math.max(...scores),
    min_score:            Math.min(...scores),
    model:                NIM_MODEL,
  }
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'NVIDIA NIM unavailable'
    throw new Error(`NVIDIA NIM failed: ${msg}`)
  }
}

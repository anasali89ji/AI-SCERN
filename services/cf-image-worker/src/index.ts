/**
 * Aiscern — Image Ensemble Worker
 *
 * WHY THIS EXISTS:
 * Vercel Hobby hard-caps serverless functions at 10s. The image detection
 * ensemble (CV worker + Gemini vision + 6 HF models, run in parallel) can
 * take well past that under cold starts. Cloudflare Workers don't count
 * fetch()-wait time against their execution limit, and `ctx.waitUntil()`
 * lets this worker ACK the request instantly while continuing the real work
 * in the background — so the slow network fan-out lives here instead.
 *
 * WHAT STAYS ON VERCEL (this worker never touches):
 *   - Brain analysis (needs `sharp`, Workers can't run it)
 *   - Pixel-signal extraction (fast, local, no reason to move it)
 *   - Everything DB/side-effect related: scans table writes, Inngest events,
 *     RAG blending, forensic-cascade firing, caching. This worker's ONLY job
 *     is the slow network fan-out + the fusion math, then it POSTs the
 *     finished result to Vercel's /api/detect/image/finalize route, which
 *     does all of that with the existing, already-tested helper functions.
 *
 * FUSION MATH: every weight, threshold, and branch below is copied verbatim
 * from lib/inference/hf-analyze.ts `analyzeImage()` (v8.1/v8.2) on the main
 * branch — not re-derived. If that file's weights change, this must be
 * updated to match or the two paths will silently disagree.
 */

export interface Env {
  HUGGINGFACE_API_TOKEN?: string
  GEMINI_API_KEY?:         string
  GEMINI_API_KEY_2?:       string
  PYTHON_WORKER_URL?:      string
  WORKER_SHARED_SECRET:    string
  CALLBACK_BASE_URL:       string
}

// ── Model registry (verbatim from hf-analyze.ts MODELS.image_*) ─────────────
const HF_API = 'https://api-inference.huggingface.co/models'
const IMAGE_MODELS = [
  { model: 'saghi776/aiscern-image-detector',        weight: 0.40 }, // image_finetuned
  { model: 'Organika/sdxl-detector',                 weight: 0.22 }, // image_primary
  { model: 'umm-maybe/AI-image-detector',             weight: 0.18 }, // image_sdxl
  { model: 'Nahrawy/AIorNot',                         weight: 0.08 }, // image_face
  { model: 'haywoodsloan/ai-image-detector',          weight: 0.08 }, // image_vit
  { model: 'dima806/deepfake_vs_real_image_detection',weight: 0.04 }, // image_deepfake
] as const

const GEMINI_MODEL = 'gemini-2.5-flash'
const SIGNAL_WORKER_TIMEOUT_MS = 15_000

interface HfLabelScore { label: string; score: number }

// ── hfInference — ported verbatim from hf-analyze.ts (same retry/timeout shape) ──
async function hfInference(
  token: string, model: string, binaryData: ArrayBuffer, timeoutMs = 15000, retries = 1,
): Promise<HfLabelScore[] | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${HF_API}/${model}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
        body:    binaryData,
        signal:  AbortSignal.timeout(timeoutMs),
      })
      if (res.status === 503) throw new Error(`Model ${model} cold`)
      if (res.status === 429) { if (i < retries) { await sleep(2000); continue }; throw new Error('HF rate limit') }
      if (!res.ok) throw new Error(`HF ${res.status}`)
      return await res.json() as HfLabelScore[]
    } catch (err) {
      if (i === retries) { console.error(`[worker] HF ${model} failed:`, (err as Error).message); return null }
      await sleep(1000)
    }
  }
  return null
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── parseImg — verbatim from hf-analyze.ts ───────────────────────────────────
function parseImg(val: HfLabelScore[] | null, w: number, m: string, mlScores: { model: string; aiScore: number; weight: number }[]) {
  if (!val || !Array.isArray(val)) return
  try {
    const aiE = val.find(s => /ai|fake|sdxl|synthetic|label_1|deepfake|generated/i.test(s.label))
    const huE = val.find(s => /real|human|authentic|label_0|photo/i.test(s.label))
    if (aiE || huE) mlScores.push({ model: m, aiScore: aiE?.score ?? (huE ? 1 - huE.score : 0.5), weight: w })
  } catch (err) {
    console.error(`[worker] Failed to parse HF result for "${m}":`, err)
  }
}

// ── Python CV worker — ported verbatim from callPythonCVWorker ──────────────
interface PythonCVResult {
  composite_cv_score: number
  cv_signals:         Record<string, number>
  composite_score?:   { v2_composite: number; v3_composite: number; fused_score: number }
}
async function callPythonCVWorker(workerUrl: string, imageBuffer: ArrayBuffer, mimeType: string): Promise<PythonCVResult | null> {
  if (!workerUrl) return null
  try {
    const form = new FormData()
    form.append('file', new Blob([imageBuffer], { type: mimeType }), 'image.jpg')
    const res = await fetch(`${workerUrl}/analyze/image`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(SIGNAL_WORKER_TIMEOUT_MS),
    })
    if (!res.ok) { console.error(`[worker] CV worker returned ${res.status}`); return null }
    const data = await res.json() as PythonCVResult
    if (typeof data.composite_cv_score !== 'number') return null
    return data
  } catch (err) {
    console.error('[worker] CV worker call failed:', (err as Error).message)
    return null
  }
}

// ── Gemini vision — same prompt/parsing as gemini-analyzer.ts geminiAnalyzeImage,
//    called via raw REST instead of the Node SDK (Workers-safe) ─────────────
const GEMINI_PROMPT = `You are an expert AI-generated image forensic analyst. You are familiar with the visual characteristics of images from modern generators including GPT-4o, Gemini/Imagen 3, DALL-E 3, Flux, Midjourney v6, Stable Diffusion XL, Adobe Firefly, Grok Aurora, Runway, Sora, and others — as well as the characteristics of genuine photographs from real cameras and phones.

Give an OBJECTIVE, EVIDENCE-BASED assessment. Do not assume either AI or human as a default — base your probability purely on what you actually observe in this specific image. Many ordinary real photos are perfectly clean, well-composed, and symmetric (centered portraits, product shots, clear skies, leveled horizons) — these are NOT evidence of AI generation on their own. Likewise, a generated image can be deliberately styled to look grainy or imperfect. Weigh the evidence as it actually appears, not against a checklist assumption.

CHECK EACH OF THESE CATEGORIES, noting that not all will apply to every image (e.g. an indoor product photo has no horizon, a landscape has no hands):

[1] HISTOGRAM AND COLOR SCIENCE:
- GPT-4o / DALL-E 3 tendency: luminance values tightly clustered in 90-215 range, missing pure blacks/whites ("clipped wings" histogram). Note: heavily compressed or low-contrast real photos can also show this — treat as weak evidence alone.
- Gemini/Imagen 3 tendency: blue channel elevated +3-7 points above red in skin tones. Note: this is also what a photo with a large blue-sky reflection or cool ambient light looks like — only meaningful if it appears in regions that shouldn't be affected by environmental color cast (e.g. indoor skin tones).
- Midjourney v6: colors oversaturated beyond typical sRGB range, with a strong "maximum aesthetic" bias.

[2] SKIN AND FACE (if a face is present):
- AI skin: either perfectly smooth with zero grain, or uniformly pored with the same pore density everywhere (real faces are denser on nose/forehead).
- Ear canal depth inconsistency, brow hairs all pointing the same direction, sclera pure white instead of slightly ivory.
- Real faces: visible pores varying by region, natural skin texture, irregular catchlights matching actual scene light sources.

[3] HANDS (if visible, one of the more reliable tells):
- Count fingers carefully. AI failure modes: wrong finger count, fused fingers, extra/missing knuckles, smooth joint transitions with no visible veins or wrinkles.
- Real hands: visible knuckle protrusions, irregular wrinkle patterns, visible veins.

[4] EYES (if visible):
- Real iris: unique radial fiber pattern with crypts and a collarette ring.
- AI iris: stamped/tiled texture, unnaturally perfect bilateral symmetry, missing natural crypts.
- Real catchlights reflect actual light sources in the scene; generic circular catchlights matching no visible light source are suspicious.

[5] PHYSICS AND LIGHTING:
- Shadows should be consistent with a single coherent light source (or sources actually visible/implied in the scene). Conflicting shadow directions are a real tell.
- Depth-of-field blur should increase continuously and physically plausibly with distance.
- Real lenses often show slight chromatic aberration at frame corners and minor barrel/pincushion distortion — but plenty of real corrected/processed photos (especially phone photos with computational correction) won't show this either, so its ABSENCE alone is weak evidence.

[6] HAIR-BACKGROUND BOUNDARY (if hair is visible against a background):
- Real hair shows individual strands with semi-transparent tips at the boundary.
- Background color bleeding through hair strands, or hair terminating in a blunt/forked way at the edges, can indicate synthesis.

Weigh ALL the evidence you actually find — both for and against AI generation — and arrive at a probability that reflects your genuine confidence, not a forced floor or ceiling. A clean, well-composed, ordinary photo with no specific tells found should score LOW (human), not be treated as suspicious by default.

Respond ONLY with valid JSON:
{"ai_probability": 0.0-1.0, "verdict": "AI"|"HUMAN"|"UNCERTAIN", "generator": "GPT4o|DALLE3|Gemini|Flux|Midjourney|SDXL|Firefly|Grok|Unknown|None", "matched_tells": ["tell1", "tell2"], "reasoning": "one sentence with specific evidence", "signals": ["signal1", "signal2"]}`

interface GeminiImageResult { aiScore: number; verdict: string; reasoning: string; generator: string; signals: string[] }

function parseGeminiJSON(raw: string) {
  try {
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    const prob = raw.match(/"ai_probability"\s*:\s*([\d.]+)/)?.[1]
    const verdict = raw.match(/"verdict"\s*:\s*"([^"]+)"/)?.[1]
    const reason  = raw.match(/"reasoning"\s*:\s*"([^"]+)"/)?.[1]
    return { ai_probability: prob ? parseFloat(prob) : 0.5, verdict: verdict ?? 'UNCERTAIN', reasoning: reason ?? 'Parse error' }
  }
}

async function callGemini(apiKey: string, imageBase64: string, mimeType: string, timeoutMs = 15000): Promise<GeminiImageResult | null> {
  try {
    const validMime = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const).find(t => t === mimeType) ?? 'image/jpeg'
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ parts: [{ text: GEMINI_PROMPT }, { inlineData: { mimeType: validMime, data: imageBase64 } }] }],
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    })
    if (!res.ok) { console.error(`[worker] Gemini returned ${res.status}`); return null }
    const data = await res.json() as any
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = parseGeminiJSON(raw)
    const aiScore = Math.max(0, Math.min(1, Number(parsed.ai_probability) || 0.5))
    return {
      aiScore,
      verdict:   parsed.verdict ?? 'UNCERTAIN',
      reasoning: parsed.reasoning ?? '',
      generator: typeof parsed.generator === 'string' ? parsed.generator : 'Unknown',
      signals:   Array.isArray(parsed.signals) ? parsed.signals : [],
    }
  } catch (err) {
    console.error('[worker] Gemini call failed:', (err as Error).message)
    return null
  }
}

// ── calibrateScore / toVerdict — verbatim from hf-analyze.ts (image branch) ──
function calibrateScore(raw: number, beta = 1.15): number {
  const sharpened = 0.5 + (raw - 0.5) * beta
  return Math.max(0.01, Math.min(0.99, sharpened))
}
function toVerdict(score: number): 'AI' | 'HUMAN' | 'UNCERTAIN' {
  if (score >= 0.55) return 'AI'
  if (score <= 0.40) return 'HUMAN'
  return 'UNCERTAIN'
}
function scoreToVerdict(score: number): 'AI' | 'HUMAN' | 'UNCERTAIN' {
  if (score >= 0.55) return 'AI'
  if (score <= 0.40) return 'HUMAN'
  return 'UNCERTAIN'
}

// ── Generator name normalization + voting — verbatim from hf-analyze.ts ─────
function normalizeGeneratorName(raw: string): string {
  const s = raw.toLowerCase()
  if (/gemini|imagen/.test(s))               return 'Gemini / Imagen'
  if (/dall-?e|gpt-?4o|gpt4o/.test(s))        return 'DALL-E / GPT-4o'
  if (/midjourney/.test(s))                  return 'Midjourney'
  if (/stable\s*diffusion|sdxl/.test(s))      return 'Stable Diffusion'
  if (/flux/.test(s))                        return 'Flux'
  if (/firefly/.test(s))                     return 'Adobe Firefly'
  if (/grok|aurora/.test(s))                 return 'Grok Aurora'
  if (/ideogram/.test(s))                    return 'Ideogram'
  if (/leonardo/.test(s))                    return 'Leonardo AI'
  if (/canva/.test(s))                       return 'Canva AI'
  return raw.trim()
}

function voteGenerator(
  brainHints: string[], brainScore: number,
  geminiGenerator: string | undefined, geminiScore: number | null,
): { name: string | null; sources: string[] } {
  const votes = new Map<string, { weight: number; sources: string[] }>()
  const add = (name: string | null | undefined, weight: number, source: string) => {
    if (!name || /^(unknown|none|n\/a)$/i.test(name.trim())) return
    const key = normalizeGeneratorName(name.split('(')[0])
    const cur = votes.get(key) ?? { weight: 0, sources: [] }
    cur.weight += weight
    cur.sources.push(source)
    votes.set(key, cur)
  }
  for (const hint of brainHints) add(hint, brainScore, 'Brain')
  add(geminiGenerator, geminiScore ?? 0.5, 'Gemini')

  if (votes.size === 0) return { name: null, sources: [] }
  let best: [string, { weight: number; sources: string[] }] | null = null
  for (const entry of votes) if (!best || entry[1].weight > best[1].weight) best = entry
  return { name: best![0], sources: best![1].sources }
}

// ── Request/response shapes ───────────────────────────────────────────────────
interface AnalyzeRequest {
  scanId:          string
  userId:          string
  imageBase64:     string
  mimeType:        string
  brainResult:     { score: number; verdict: string; generatorHints: string[]; findings: string[]; signals: { name: string; evidence: string; score: number; weight: number }[] }
  imgSignals:      { name: string; description: string; score: number; weight: number }[]
  imgSignalScore:  number
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/analyze') {
      return new Response('Not found', { status: 404 })
    }
    const auth = req.headers.get('X-Worker-Secret')
    if (!env.WORKER_SHARED_SECRET || auth !== env.WORKER_SHARED_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    let body: AnalyzeRequest
    try {
      body = await req.json()
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }
    if (!body.scanId || !body.imageBase64) {
      return new Response('Missing scanId or imageBase64', { status: 400 })
    }

    // ACK immediately — the real work continues in the background via waitUntil.
    // This is the entire point: Vercel's fetch() to us returns in well under 1s.
    ctx.waitUntil(processInBackground(body, env))
    return new Response(JSON.stringify({ accepted: true, scanId: body.scanId }), {
      status: 202, headers: { 'Content-Type': 'application/json' },
    })
  },
}

async function processInBackground(body: AnalyzeRequest, env: Env) {
  const { scanId, userId, imageBase64, mimeType, brainResult, imgSignals, imgSignalScore } = body
  const startTime = Date.now()

  try {
    const imageBuffer = base64ToArrayBuffer(imageBase64)

    // ── Parallel fan-out — the whole reason this lives here and not on Vercel ──
    const cvPromise = callPythonCVWorker(env.PYTHON_WORKER_URL ?? '', imageBuffer, mimeType)
    const geminiPromise = env.GEMINI_API_KEY
      ? callGemini(env.GEMINI_API_KEY, imageBase64, mimeType).catch(() => null)
      : Promise.resolve(null)
    const hfPromise = env.HUGGINGFACE_API_TOKEN
      ? Promise.all(IMAGE_MODELS.map(m => hfInference(env.HUGGINGFACE_API_TOKEN!, m.model, imageBuffer, 15000)))
      : Promise.resolve(IMAGE_MODELS.map(() => null))

    const [cvWorkerResult, geminiResult, hfResults] = await Promise.all([cvPromise, geminiPromise, hfPromise])

    // ── Fusion — verbatim from hf-analyze.ts analyzeImage() (v8.1/v8.2) ──────
    const mlScores: { model: string; aiScore: number; weight: number }[] = []
    IMAGE_MODELS.forEach((m, i) => parseImg(hfResults[i], m.weight, m.model, mlScores))

    const mlTotalW    = mlScores.reduce((s, m) => s + m.weight, 0) || 1
    const mlScore     = mlScores.length ? mlScores.reduce((s, m) => s + m.aiScore * (m.weight / mlTotalW), 0) : null
    const geminiScore = geminiResult?.aiScore ?? null
    const cvScore     = cvWorkerResult?.composite_score?.fused_score ?? cvWorkerResult?.composite_cv_score ?? null

    const llmScore = geminiScore // grok disabled, matches main branch's GROK_ENABLED = false

    let aiScore: number, modelUsed: string, engineDesc: string, llmWeightUsed = 0

    const cvAvailable = cvScore !== null
    const hfAvailable = mlScore !== null
    const llmAvailable = llmScore !== null

    const imgDegradedSignals: string[] = [
      ...(!cvAvailable  ? [env.PYTHON_WORKER_URL ? 'cv-worker-offline' : 'cv-worker-unconfigured'] : []),
      ...(!hfAvailable  ? ['hf-ensemble-cold-or-failed'] : []),
      ...(!llmAvailable ? [env.GEMINI_API_KEY ? 'gemini-call-failed' : 'gemini-unconfigured'] : []),
    ]

    if (cvAvailable && hfAvailable && llmAvailable) {
      llmWeightUsed = 0.20
      aiScore    = brainResult.score * 0.31 + cvScore * 0.22 + mlScore * 0.18 + imgSignalScore * 0.09 + llmScore * llmWeightUsed
      modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain31%+CV22%+HF18%+Pixel9%+LLM20%)'
      engineDesc = `Brain (31%) + CV-Worker (22%) + ${mlScores.length} HF ViT (18%) + Pixel (9%) + LLM Gemini (20%)`
    } else if (cvAvailable && hfAvailable) {
      aiScore    = brainResult.score * 0.37 + cvScore * 0.28 + mlScore * 0.20 + imgSignalScore * 0.15
      modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain37%+CV28%+HF20%+Pixel15%)'
      engineDesc = `Brain (37%) + CV-Worker (28%) + ${mlScores.length} HF ViT (20%) + Pixel (15%) — no LLM`
    } else if (cvAvailable && llmAvailable) {
      llmWeightUsed = 0.20
      aiScore    = brainResult.score * 0.38 + cvScore * 0.29 + imgSignalScore * 0.13 + llmScore * llmWeightUsed
      modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain38%+CV29%+Pixel13%+LLM20%)'
      engineDesc = 'Brain (38%) + CV-Worker (29%) + Pixel (13%) + LLM (20%) — HF cold-starting'
    } else if (cvAvailable) {
      aiScore    = brainResult.score * 0.47 + cvScore * 0.38 + imgSignalScore * 0.15
      modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain47%+CV38%+Pixel15%)'
      engineDesc = 'Brain (47%) + CV-Worker (38%) + Pixel (15%) — no LLM or HF'
    } else if (hfAvailable && llmAvailable) {
      llmWeightUsed = 0.20
      aiScore    = brainResult.score * 0.40 + mlScore * 0.22 + imgSignalScore * 0.18 + llmScore * llmWeightUsed
      modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain40%+HF22%+Pixel18%+LLM20%)'
      engineDesc = `Brain (40%) + ${mlScores.length} HF ViT (22%) + Pixel (18%) + LLM (20%) — CV worker offline`
    } else if (hfAvailable) {
      aiScore    = brainResult.score * 0.50 + mlScore * 0.30 + imgSignalScore * 0.20
      modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain50%+HF30%+Pixel20%)'
      engineDesc = `Brain (50%) + ${mlScores.length} HF ViT (30%) + Pixel (20%) — no CV or LLM`
    } else {
      aiScore    = brainResult.score * 0.65 + imgSignalScore * 0.35
      modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain65%+Pixel35%)'
      engineDesc = 'Image Brain (65%) + Pixel signals (35%) — configure PYTHON_WORKER_URL for best accuracy'
    }

    // LLM Consensus Override — verbatim
    if (llmScore !== null && llmScore > 0.80) {
      const nonLlmScore = aiScore - (llmScore * llmWeightUsed)
      const brainCvAgree = (brainResult.score > 0.55) && (cvScore === null || cvScore > 0.55)
      if (brainCvAgree) {
        aiScore = Math.min(aiScore + 0.08, Math.max(aiScore, nonLlmScore + (llmScore - 0.50) * 0.10))
      }
    }

    // Generator attribution — verbatim
    const generatorVote = voteGenerator(brainResult.generatorHints, brainResult.score, geminiResult?.generator, geminiScore)
    if (generatorVote.name && aiScore > 0.45) {
      if (generatorVote.sources.length >= 2) {
        aiScore = Math.max(aiScore, 0.80)
      } else if (brainResult.verdict === 'AI' && brainResult.generatorHints.length > 0 && brainResult.score > 0.52) {
        aiScore = Math.max(aiScore, brainResult.score * 0.88)
      }
    }

    const calibratedImgScore = calibrateScore(aiScore)
    const editSig = imgSignals.find(s => s.name === 'Edit Signature')
    const isEdited = editSig && editSig.score > 0.65 && calibratedImgScore < 0.52 && calibratedImgScore > 0.30
    const verdict: 'AI' | 'HUMAN' | 'UNCERTAIN' = isEdited ? 'AI' : toVerdict(calibratedImgScore)

    const topSignal  = [...imgSignals].sort((a, b) => b.score - a.score)[0]
    const geminiSigs = geminiResult?.signals ?? []

    const brainSignalsFormatted = brainResult.signals
      .sort((a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5))
      .slice(0, 5)
      .map(sig => ({ name: sig.name, category: 'Image Brain', description: sig.evidence, weight: Math.round(sig.weight * 50), value: Math.round(sig.score * 1000) / 1000, flagged: sig.score > 0.62 }))

    const cvSignalsFormatted = cvWorkerResult?.cv_signals
      ? Object.entries(cvWorkerResult.cv_signals).slice(0, 4).map(([name, score]) => ({
          name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), category: 'CV Forensic',
          description: `Python 6-layer CV forensic signal: ${name}`, weight: 25,
          value: Math.round(score * 1000) / 1000, flagged: score > 0.60,
        }))
      : []

    const confidence = Math.round(calibratedImgScore * 1000) / 1000
    const result = {
      verdict, confidence, model_used: modelUsed, model_version: '8.1.0-worker',
      generator_attribution: generatorVote.name
        ? { generator: generatorVote.name, corroborating_sources: generatorVote.sources, confidence: generatorVote.sources.length >= 2 ? 'high' : 'low' }
        : null,
      degraded_signals: imgDegradedSignals,
      signals: [
        {
          name: 'Image Detection Brain', category: 'ML',
          description: `${engineDesc}. Brain verdict: ${brainResult.verdict} (${Math.round(brainResult.score * 100)}%). ` +
            (generatorVote.name ? `Generator: ${generatorVote.name} (${generatorVote.sources.join('+')} agree). ` : (brainResult.generatorHints.length ? `Generator: ${brainResult.generatorHints.join('; ')}. ` : '')) +
            `Top: ${brainResult.findings[0] ?? 'pixel pattern analysis'}` + (geminiSigs.length ? ` | Gemini: ${geminiSigs.slice(0, 2).join(', ')}` : ''),
          weight: 50, value: Math.round(brainResult.score * 1000) / 1000, flagged: brainResult.score > 0.60,
        },
        ...brainSignalsFormatted,
        ...cvSignalsFormatted,
        ...imgSignals.map(sig => ({ name: sig.name, category: 'Pixel Analysis', description: sig.description, weight: Math.round(sig.weight * 20), value: sig.score, flagged: sig.score > 0.58 })),
      ],
      model_breakdown: [
        { model_id: 'image-brain-v2', raw_score: brainResult.score, verdict: scoreToVerdict(brainResult.score), latency_ms: 0 },
        ...(cvScore     !== null ? [{ model_id: 'python-cv-worker-v3',     raw_score: cvScore,     verdict: scoreToVerdict(cvScore),     latency_ms: 0 }] : []),
        ...(geminiScore !== null ? [{ model_id: 'gemini-2.5-flash-vision', raw_score: geminiScore, verdict: scoreToVerdict(geminiScore), latency_ms: 0 }] : []),
        ...mlScores.map(m => ({ model_id: m.model, raw_score: m.aiScore, verdict: scoreToVerdict(m.aiScore), latency_ms: 0 })),
        { model_id: 'pixel-signals-v2', raw_score: imgSignalScore, verdict: scoreToVerdict(imgSignalScore), latency_ms: 0 },
      ],
      summary: verdict === 'AI'
        ? `AI-generated image detected with ${Math.round(calibratedImgScore * 100)}% confidence. ` +
          (generatorVote.name ? `Likely generator: ${generatorVote.name}${generatorVote.sources.length >= 2 ? ` (confirmed by ${generatorVote.sources.join(' + ')})` : ''}. ` : (brainResult.generatorHints.length ? `Likely generator: ${brainResult.generatorHints[0]}. ` : '')) +
          `Key signals: ${brainResult.findings.slice(0, 2).join(' | ')}.`
        : verdict === 'HUMAN'
        ? `Image appears authentic — ${Math.round((1 - calibratedImgScore) * 100)}% confidence. Natural camera characteristics: ${topSignal?.name ?? 'organic noise floor detected'}.`
        : `Analysis inconclusive (${Math.round(calibratedImgScore * 100)}% AI probability). ${generatorVote.name ? `Possible generator: ${generatorVote.name}.` : (brainResult.generatorHints.length ? `Possible generator: ${brainResult.generatorHints[0]}.` : 'Try a higher-resolution original image for accuracy.')}`,
      processing_time: Date.now() - startTime,
    }

    // ── Hand off to Vercel for persistence/side-effects ─────────────────────
    await fetch(`${env.CALLBACK_BASE_URL}/api/detect/image/finalize`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': env.WORKER_SHARED_SECRET },
      body:    JSON.stringify({ scanId, userId, result }),
      signal:  AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error(`[worker] Background processing failed for scan ${scanId}:`, err)
    // Best-effort failure callback so the client isn't left polling forever
    try {
      await fetch(`${env.CALLBACK_BASE_URL}/api/detect/image/finalize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': env.WORKER_SHARED_SECRET },
        body:    JSON.stringify({ scanId, userId, error: err instanceof Error ? err.message : 'Worker processing failed' }),
        signal:  AbortSignal.timeout(10_000),
      })
    } catch { /* nothing more we can do */ }
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

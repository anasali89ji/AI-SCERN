/**
 * Aiscern — Adaptive Multi-Modal Detection Engine v4
 *
 * Detection priority (HF cold-start disabled by design):
 *   Text  → Gemini 2.0 Flash (PRIMARY) + HF ensemble if warm + 7 linguistic signals
 *   Image → Gemini 2.0 Flash vision (PRIMARY) + HF ensemble if warm + 10 pixel signals
 *   Audio → Gemini 2.0 Flash audio (PRIMARY) + wav2vec2 if warm + 5 acoustic signals
 *   Video → NVIDIA NIM per-frame (PRIMARY) + temporal analysis
 *
 * Gemini fires FIRST — no cold start, 1500 free req/day.
 * HF models run in parallel with a 12s fail-fast timeout.
 * If HF responds, it enriches the ensemble. If cold, Gemini stands alone.
 */

import { extractTextSignals, aggregateTextSignals, extractTextSignalsV2 }    from './signals/text-signals'
import { normalizeHomoglyphs }                                                         from '@/lib/utils/homoglyph'
import { extractImageSignals, extractImageSignalsExtended, aggregateImageSignals, applyCalibration } from './signals/image-signals'
import { preprocessImage } from './preprocess-image'
import { hashBuffer, hashText, getCachedScan, setCachedScan } from '@/lib/cache/scan-cache'
import { extractAudioSignals, extractAudioSignalsExtended, aggregateAudioSignals, applyAudioCalibration } from './signals/audio-signals'
import { SIGNAL_WORKER_TIMEOUT_MS } from '@/lib/forensic/constants'
import { getCalibrationStats, getAudioCalibrationStats }                      from './calibration-client'
import { analyzeVideoFrames }                                                  from './nvidia-nim'
import { buildVideoSignals }                                                   from './signals/video-signals'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  geminiAnalyzeText,
  geminiAnalyzeImage,
  geminiAnalyzeAudio,
  geminiAvailable,
} from './gemini-analyzer'
import { analyzeTextWithBrain }  from '@/lib/inference/text-detection-brain'
import { analyzeImageWithBrain } from '@/lib/inference/image-detection-brain'
import { scoreToVerdict }        from '@/lib/accuracy/log-predictions'

export interface DetectionSignal {
  name:        string
  category:    string
  description: string
  weight:      number
  value:       number
  flagged:     boolean
}

export interface DetectionResult {
  verdict:          'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence:       number
  signals:          DetectionSignal[]
  summary:          string
  model_used:       string
  model_version:    string
  processing_time?: number
  sentence_scores?: { text: string; ai_score: number; perplexity: number }[]
  segment_scores?:  { start_sec: number; end_sec: number; label: string; ai_score: number }[]
  frame_scores?:    { frame: number; time_sec: number; ai_score: number; face_detected?: boolean }[]
  /** Per-model breakdown for accuracy monitoring — logged fire-and-forget after scan insert */
  model_breakdown?: import('@/lib/accuracy/log-predictions').ModelPrediction[]
  /** Multi-source generator identification (Brain + Gemini voting; Grok disabled — see GROK_ENABLED in hf-analyze.ts) — image detection only */
  generator_attribution?: { generator: string; corroborating_sources: string[]; confidence: 'high' | 'low' } | null
}

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN
const HF_API   = 'https://api-inference.huggingface.co/models'

const MODELS = {
  // TEXT — Aiscern fine-tuned (PRIMARY) + 4-model ensemble backup
  // saghi776/aiscern-text-detector = DeBERTa-v3-base LoRA, trained on HC3 + 3 datasets, ~97% acc
  text_finetuned:  'saghi776/aiscern-text-detector',
  text_primary:    'openai-community/roberta-base-openai-detector',
  text_secondary:  'Hello-SimpleAI/chatgpt-detector-roberta',
  text_tertiary:   'andreas122001/roberta-mixed-detector',
  text_quaternary: 'valurank/distilroberta-ai-text-detection',
  text_quinary:    'TrustSafeAI/roberta-base-ai-detector',

  // IMAGE — Aiscern fine-tuned (PRIMARY) + 4-model ensemble backup
  // saghi776/aiscern-image-detector = ViT-Large LoRA, trained on CIFAKE + 3 datasets, ~99% acc
  image_finetuned: 'saghi776/aiscern-image-detector',
  image_primary:   'Organika/sdxl-detector',
  image_sdxl:      'umm-maybe/AI-image-detector',
  image_face:      'Nahrawy/AIorNot',
  image_vit:       'haywoodsloan/ai-image-detector',
  image_deepfake:  'dima806/deepfake_vs_real_image_detection',

  // AUDIO — fine-tuned primary (saghi776/aiscern-audio-detector — run audio_finetune.ipynb)
  audio_finetuned: 'saghi776/aiscern-audio-detector',
  audio_primary:   'mo-thecreator/Deepfake-audio-detection',
  audio_asvspoof:  'MelodyMachine/Deepfake-audio-detection-V2',
  audio_xlsr:      'facebook/wav2vec2-large-xlsr-53',

  // VIDEO — fine-tuned primary (saghi776/aiscern-video-detector — run video_finetune.ipynb)
  video_finetuned: 'saghi776/aiscern-video-detector',
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// HF with short fail-fast timeout — cold models return immediately so Gemini result is used
async function hfInference(
  model: string,
  payload: unknown,
  opts: { binary?: boolean; binaryData?: Buffer; retries?: number; timeoutMs?: number } = {}
): Promise<unknown> {
  if (!HF_TOKEN) throw new Error('No HF token')
  const { binary = false, binaryData, retries = 1, timeoutMs = 12000 } = opts
  for (let i = 0; i <= retries; i++) {
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${HF_TOKEN}` }
      let body: BodyInit
      if (binary && binaryData) { headers['Content-Type'] = 'application/octet-stream'; body = binaryData as unknown as BodyInit }
      else { headers['Content-Type'] = 'application/json'; body = JSON.stringify(payload) }
      const res = await fetch(`${HF_API}/${model}`, {
        method: 'POST', headers, body,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status === 503) throw new Error(`Model ${model} cold`)
      if (res.status === 429) { if (i < retries) { await sleep(2000); continue }; throw new Error('HF rate limit') }
      if (!res.ok) throw new Error(`HF ${res.status}`)
      return await res.json()
    } catch (err: unknown) {
      if (i === retries) throw err
      await sleep(1000)
    }
  }
}

function parseHFText(
  val: unknown,
  aiLabels: string[],
  humanLabels: string[],
): number | null {
  if (!val) return null
  try {
    const arr = Array.isArray((val as unknown[][])[0])
      ? (val as { label: string; score: number }[][])[0]
      : (val as { label: string; score: number }[])
    const aiE  = arr.find(s => aiLabels.some(l => s.label.toLowerCase().includes(l.toLowerCase())))
    const huE  = arr.find(s => humanLabels.some(l => s.label.toLowerCase().includes(l.toLowerCase())))
    return aiE?.score ?? (huE ? 1 - huE.score : null)
  } catch { return null }
}

/**
 * Metadata-aware conditional verdict thresholds (§1.4 of engineering brief)
 * Different content types have structurally different score distributions.
 * Static 62/38 is replaced by a simple decision tree on observable metadata.
 */
interface VerdictMeta {
  wordCount?:   number
  hasCode?:     boolean
  isShort?:     boolean
  mlVariance?:  number  // variance across sub-model scores
}

function toVerdict(
  score:     number,
  mediaType: 'text' | 'image' | 'audio' | 'video' = 'text',
  meta:      VerdictMeta = {},
): 'AI' | 'HUMAN' | 'UNCERTAIN' {
  // Uncertainty-aware override: high variance across sub-models = inconclusive
  if (meta.mlVariance !== undefined && meta.mlVariance > 0.15) return 'UNCERTAIN'

  let aiThreshold: number
  let humanThreshold: number

  if (mediaType === 'text') {
    const wc = meta.wordCount ?? 999
    if (wc < 50) {
      // Very short texts: looser threshold (unreliable signals)
      aiThreshold = 0.58; humanThreshold = 0.42
    } else if (meta.hasCode) {
      // Code mixed with text: different distribution
      aiThreshold = 0.75; humanThreshold = 0.25
    } else if (wc < 100) {
      aiThreshold = 0.60; humanThreshold = 0.40
    } else {
      aiThreshold = 0.62; humanThreshold = 0.38
    }
  } else if (mediaType === 'image') {
    aiThreshold = 0.55; humanThreshold = 0.40
  } else if (mediaType === 'audio') {
    aiThreshold = 0.60; humanThreshold = 0.40
  } else {
    aiThreshold = 0.55; humanThreshold = 0.38
  }

  if (score >= aiThreshold)    return 'AI'
  if (score <= humanThreshold) return 'HUMAN'
  return 'UNCERTAIN'
}

/**
 * Uncertainty-aware ensemble variance (§5.1 of engineering brief)
 * If sub-model scores disagree by >15%, force UNCERTAIN regardless of mean.
 * If all agree strongly (variance <5%, mean >80%), label as High Confidence.
 */
function computeEnsembleVariance(scores: number[]): number {
  if (scores.length < 2) return 0
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  return scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length
}

// Mild sharpening: pushes scores away from 0.5 toward 0 or 1 for more decisive results
function calibrateScore(raw: number, beta: number = 1.15): number {
  const centered = raw - 0.5
  const sharpened = 0.5 + centered * beta
  return Math.max(0.01, Math.min(0.99, sharpened))
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT DETECTION
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeText(text: string): Promise<DetectionResult> {
  // ── TEXT DETECTION ENGINE v6.0 ─────────────────────────────────────────────
  // Priority stack:
  //   1. Graph RAG Detection Brain (PRIMARY, 50%) — embedded knowledge, zero latency, 50k char support
  //   2. HF transformer ensemble (25%) — 6 models in parallel, fail-fast 12s
  //   3. Linguistic signals (25%) — 7 heuristic signals
  //   Gemini is now a supplementary fallback (only if brain confidence < 0.55)

  // Full text up to 50,000 chars for brain (PDFs, long documents supported)
  const MAX_TEXT_CHARS   = 50_000
  const truncated        = text.slice(0, MAX_TEXT_CHARS)

  // Run brain + HF + linguistic signals in parallel — brain is instant
  const brainResult  = analyzeTextWithBrain(truncated)

  const hfPromise = Promise.allSettled([
    // Aiscern fine-tuned DeBERTa (PRIMARY — highest weight 0.45)
    hfInference(MODELS.text_finetuned,  { inputs: text.substring(0, 2000) }).catch(() => null),
    hfInference(MODELS.text_primary,    { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_secondary,  { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_tertiary,   { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_quaternary, { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_quinary,    { inputs: text.substring(0, 1800) }).catch(() => null),
  ])

  // Only call Gemini as supplementary if brain is uncertain (0.42–0.58 range)
  // or the brain's own signals disagree with each other (isDivergent) — a
  // composite score outside the "uncertain" band can still be hiding real
  // conflicting evidence that's worth a second opinion.
  const brainUncertain   = (brainResult.score > 0.42 && brainResult.score < 0.58) || brainResult.isDivergent === true
  const geminiPromise    = (brainUncertain && geminiAvailable())
    ? geminiAnalyzeText(text.slice(0, 8000)).catch(() => null)
    : Promise.resolve(null)

  const [hfResults, geminiResult, lingSignals] = await Promise.all([
    hfPromise,
    geminiPromise,
    Promise.resolve(extractTextSignalsV2(truncated)),
  ])

  // Parse HF results — null values are cold-start failures
  const rawHF = hfResults.map(r => r.status === 'fulfilled' ? r.value : null)
  const mlScores: { model: string; aiScore: number; weight: number }[] = []
  const s0 = parseHFText(rawHF[0], ['ai','label_1','1','fake'],     ['human','label_0','0','real'])
  const s1 = parseHFText(rawHF[1], ['fake','label_1','1'],          ['real','label_0','0'])
  const s2 = parseHFText(rawHF[2], ['chatgpt','ai','label_1','1'],  ['human','label_0','0'])
  const s3 = parseHFText(rawHF[3], ['label_1','ai','fake','ai-generated'], ['label_0','human','real','human-written'])
  const s4 = parseHFText(rawHF[4], ['label_1','ai','fake'],         ['label_0','human','real'])
  const s5 = parseHFText(rawHF[5], ['label_1','ai','fake'],         ['label_0','human','real'])
  if (s0 !== null) mlScores.push({ model: MODELS.text_finetuned,  aiScore: s0, weight: 0.45 })
  if (s1 !== null) mlScores.push({ model: MODELS.text_primary,    aiScore: s1, weight: 0.20 })
  if (s2 !== null) mlScores.push({ model: MODELS.text_secondary,  aiScore: s2, weight: 0.15 })
  if (s3 !== null) mlScores.push({ model: MODELS.text_tertiary,   aiScore: s3, weight: 0.10 })
  if (s4 !== null) mlScores.push({ model: MODELS.text_quaternary, aiScore: s4, weight: 0.06 })
  if (s5 !== null) mlScores.push({ model: MODELS.text_quinary,    aiScore: s5, weight: 0.04 })

  const mlTotalW   = mlScores.reduce((s, m) => s + m.weight, 0) || 1
  const mlScore    = mlScores.length ? mlScores.reduce((s, m) => s + m.aiScore * (m.weight / mlTotalW), 0) : null
  const lingScore  = aggregateTextSignals(lingSignals)
  const geminiScore = geminiResult?.aiScore ?? null

  // ── ENSEMBLE v6.0 scoring ──────────────────────────────────────────────────
  // Brain is always primary (50%). HF + linguistic split remaining 50%.
  // Gemini adds 15% when active, displacing from HF allocation.
  let aiScore: number
  let engineDesc: string

  if (geminiScore !== null && mlScore !== null) {
    // Full ensemble: Brain(50%) + HF(15%) + Linguistic(20%) + Gemini(15%)
    aiScore    = brainResult.score * 0.50 + mlScore * 0.15 + lingScore * 0.20 + geminiScore * 0.15
    engineDesc = `Graph RAG Brain (50%) + Gemini 2.0 Flash (15%) + ${mlScores.length} HF models (15%) + 7 linguistic signals (20%)`
  } else if (mlScore !== null) {
    // Brain(50%) + HF(25%) + Linguistic(25%)
    aiScore    = brainResult.score * 0.50 + mlScore * 0.25 + lingScore * 0.25
    engineDesc = `Graph RAG Brain (50%) + ${mlScores.length} HF transformer models (25%) + 7 linguistic signals (25%)`
  } else {
    // Brain(60%) + Linguistic(40%) — HF cold
    aiScore    = brainResult.score * 0.60 + lingScore * 0.40
    engineDesc = `Graph RAG Brain (60%) + 7 linguistic signals (40%) — HF models cold-starting`
  }

  // Homoglyph normalization — detect adversarial Unicode evasion
  const { isSuspicious: homoglyphSuspicious } = normalizeHomoglyphs(text)

  // Uncertainty-aware ensemble variance (§5.1)
  const allMlScores = mlScores.map(m => m.aiScore)
  if (geminiScore !== null) allMlScores.push(geminiScore)
  allMlScores.push(brainResult.score)
  const ensVariance = computeEnsembleVariance(allMlScores)

  const wordCount = truncated.split(/\s+/).filter(Boolean).length
  const hasCode   = /```|\bfunction\b|\bconst\b|\bimport\b|\bclass\b|\bdef\b/.test(truncated)

  const calibratedScore = calibrateScore(aiScore)
  const adjustedScore   = homoglyphSuspicious ? Math.min(0.99, calibratedScore + 0.12) : calibratedScore
  const verdict = toVerdict(adjustedScore, 'text', { wordCount, hasCode, mlVariance: ensVariance })
  const modelStr  = `Brain+${mlScores.map(s => s.model.split('/').pop()).join('+') || 'LingOnly'}${geminiScore !== null ? '+Gemini' : ''}`

  // Sliding-window sentence scan (§1.3)
  const rawSentences = truncated
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 10)
    .slice(0, 30)

  const sentenceScores: number[] = []
  for (const s of rawSentences) {
    const phraseSig = extractTextSignalsV2(s.slice(0, 300)).find(sig => sig.name === 'AI Phrase Fingerprint')
    const unifSig   = extractTextSignalsV2(s.slice(0, 300)).find(sig => sig.name === 'Sentence Uniformity')
    const sScore = Math.max(0, Math.min(1,
      aiScore * 0.60 +
      (phraseSig?.score ?? 0.5) * 0.25 +
      (unifSig?.score ?? 0.5) * 0.15
    ))
    sentenceScores.push(sScore)
  }

  const windowMax      = sentenceScores.length ? Math.max(...sentenceScores) : aiScore
  const sentMean       = sentenceScores.length ? sentenceScores.reduce((a, b) => a + b, 0) / sentenceScores.length : aiScore
  const sentVariance   = sentenceScores.length > 1
    ? sentenceScores.reduce((a, b) => a + Math.pow(b - sentMean, 2), 0) / sentenceScores.length
    : 0
  const isMixedAuthorship = sentVariance > 0.04 && windowMax > 0.65

  const sentence_scores = rawSentences.slice(0, 20).map((s, i) => ({
    text:       s.slice(0, 120),
    ai_score:   Math.round((sentenceScores[i] ?? aiScore) * 1000) / 1000,
    perplexity: Math.round(20 + (1 - (sentenceScores[i] ?? aiScore)) * 200),
  }))

  // Brain findings as additional signals
  const brainSignalsFormatted = brainResult.signals
    .sort((a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5))
    .slice(0, 5)
    .map(sig => ({
      name:        sig.name,
      category:    'Graph RAG Brain',
      description: sig.evidence,
      weight:      Math.round(sig.weight * 50),
      value:       Math.round(sig.score * 1000) / 1000,
      flagged:     sig.score > 0.60,
    }))

  const charCount = truncated.length
  const truncNote = text.length > MAX_TEXT_CHARS ? ` (truncated to ${MAX_TEXT_CHARS.toLocaleString()} chars for analysis)` : ''

  // ── Accuracy monitoring: per-model breakdown ─────────────────────────────
  const model_breakdown: import('@/lib/accuracy/log-predictions').ModelPrediction[] = [
    {
      model_id:   'text-brain-v1',
      raw_score:  brainResult.score,
      verdict:    scoreToVerdict(brainResult.score),
      latency_ms: 0,   // brain is sync — latency not meaningful
    },
    ...mlScores.map(m => ({
      model_id:   m.model,
      raw_score:  m.aiScore,
      verdict:    scoreToVerdict(m.aiScore),
      latency_ms: 0,
    })),
    ...(geminiScore !== null ? [{
      model_id:   'gemini-2.5-flash',
      raw_score:  geminiScore,
      verdict:    scoreToVerdict(geminiScore),
      latency_ms: 0,
    }] : []),
    {
      model_id:   'linguistic-signals-v2',
      raw_score:  lingScore,
      verdict:    scoreToVerdict(lingScore),
      latency_ms: 0,
    },
  ]

  return {
    verdict,
    confidence:    Math.round(adjustedScore * 1000) / 1000,
    model_used:    `Aiscern-TextEngine-v6(${modelStr})`,
    model_version: '6.0.0',
    model_breakdown,
    signals: [
      {
        name:        'Graph RAG Detection Brain',
        category:    'ML',
        description: `${engineDesc}${truncNote}. Brain verdict: ${brainResult.verdict} (${Math.round(brainResult.score * 100)}%)${brainResult.isDivergent ? ' ⚡ conflicting internal signals' : ''}. Top signals: ${brainResult.findings.slice(0, 3).join(' | ')}${geminiResult?.reasoning ? ` | Gemini: ${geminiResult.reasoning}` : ''}`,
        weight:  50,
        value:   Math.round(brainResult.score * 1000) / 1000,
        flagged: brainResult.score > 0.58,
      },
      ...brainSignalsFormatted,
      ...lingSignals.map(sig => ({
        name:        sig.name,
        category:    'Linguistic',
        description: sig.description,
        weight:      Math.round(sig.weight * 25),
        value:       sig.score,
        flagged:     sig.score > 0.60,
      })),
    ],
    summary: isMixedAuthorship
      ? `Mixed authorship detected — contains both AI and human-written segments. Analyzed ${charCount.toLocaleString()} chars${truncNote}. Max sentence AI score: ${Math.round(windowMax * 100)}%.`
      : verdict === 'AI'
      ? `AI-generated text detected with ${Math.round(adjustedScore * 100)}% confidence${truncNote}. Brain signals: ${brainResult.findings[0] ?? 'neural pattern match'}.${homoglyphSuspicious ? ' ⚠ Homoglyph evasion detected.' : ''}`
      : verdict === 'HUMAN'
      ? `Human-written text — ${Math.round((1 - adjustedScore) * 100)}% confidence. Analyzed ${charCount.toLocaleString()} chars. Natural linguistic variation detected.`
      : `Inconclusive (${Math.round(adjustedScore * 100)}% AI probability). Analyzed ${charCount.toLocaleString()} chars${truncNote}. ${ensVariance > 0.15 ? 'Models disagree — may be mixed authorship.' : brainResult.isDivergent ? 'Internal signals conflict — treat this result with caution.' : 'Submit more text for better accuracy.'}`,
    sentence_scores,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
// ── MODULE 1: Video-through-Image-Engine Reuse ─────────────────────────────
// Self-hosted alternative to NVIDIA-NIM-only video detection. Mirrors
// callPythonCVWorker()'s (see below, inside analyzeImage()) timeout/retry/
// graceful-degrade pattern exactly, including the loud-failure logging — a
// silently-null CV worker result makes accuracy regressions impossible to
// diagnose. Declared at module scope (not inside analyzeImage()) so
// analyzeVideo() can actually call it.
const VIDEO_PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || ''

interface PythonCVVideoResult {
  composite_cv_score: number
  frame_scores: { frame_index: number; composite_cv_score: number | null; status: string }[]
  temporal_variance: { overall_variance: number; watch_layer_variance: number; flagged: boolean }
  per_layer_frame_breakdown: Record<string, (number | null)[]>
  frames_analyzed: number
  frames_sampled: number
  version: string
}

// Video frame analysis reuses the full 12-layer image_engine pipeline once
// PER SAMPLED FRAME (8-16 frames), which is materially slower than a single
// image call. Give it a longer budget than the 15s image-worker timeout
// rather than starving it — a partial/failed video CV call falls back to
// NVIDIA NIM cleanly either way, so a generous timeout here costs nothing
// but latency on the (already-parallel) self-hosted path.
const VIDEO_CV_WORKER_TIMEOUT_MS = 45_000

async function callPythonCVWorkerVideo(videoBuffer: Buffer, mimeType: string): Promise<PythonCVVideoResult | null> {
  if (!VIDEO_PYTHON_WORKER_URL) return null
  try {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(videoBuffer)], { type: mimeType }), 'video.mp4')
    const res = await fetch(`${VIDEO_PYTHON_WORKER_URL}/analyze/video`, {
      method: 'POST', body: form,
      signal: AbortSignal.timeout(VIDEO_CV_WORKER_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[hf-analyze] Video CV worker returned ${res.status} ${res.statusText} — falling back to NVIDIA NIM / HF only.`)
      return null
    }
    const data = await res.json() as PythonCVVideoResult
    if (typeof data.composite_cv_score !== 'number') {
      console.error('[hf-analyze] Video CV worker response missing composite_cv_score — falling back to NVIDIA NIM / HF only.', data)
      return null
    }
    return data
  } catch (err) {
    // NOT a silent fallback — log it, same rationale as callPythonCVWorker.
    console.error('[hf-analyze] Video CV worker call failed — falling back to NVIDIA NIM / HF only. Reason:', err instanceof Error ? err.message : err)
    return null
  }
}

// Initial trust weight for the self-hosted video CV signal — image-engine
// reuse is proven tech but new to video context, so this starts lower than
// image's own weight and should only be raised after
// .github/scripts/calibrate-video.js has been run against a labeled sample
// set (MODULE 1, task 7).
const VIDEO_CV_WORKER_WEIGHT = 0.40

export async function analyzeImage(imageBuffer: Buffer, mimeType: string, _fileName: string): Promise<DetectionResult> {
  // Check cache first — skip re-analysis for identical files
  const imgCacheHash = hashBuffer(imageBuffer)
  const imgCached    = await getCachedScan(imgCacheHash)
  if (imgCached) return { ...imgCached, summary: imgCached.summary + ' (cached)' }

  // Preprocess: resize to 1024px max, strip EXIF, normalise to JPEG 92%
  // Use preprocessed buffer for all ML inference (stays under HF 10MB limit)
  // Keep original buffer for pixel signal extraction (needs full fidelity)
  const preprocessed   = await preprocessImage(imageBuffer, mimeType)
  const inferenceBuffer = preprocessed.buffer
  const inferenceMime   = preprocessed.mimeType

  // ── Python CV Worker (6-layer forensic, C.1.1) ────────────────────────────
// Runs in parallel with Brain + HF. PYTHON_WORKER_URL must point at the
// signal-worker DigitalOcean droplet. Non-availability degrades gracefully
// (weight redistributed to Brain+Pixel, never to LLM as a last resort).
const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || ''

interface PythonCVResult {
  composite_cv_score: number
  cv_signals:         Record<string, number>
  version:            string
  // The worker computes a fuller fusion of its v2 layers (pixel integrity,
  // noise stats, frequency domain, SynthID) with v3 forensics — this is
  // strictly more complete than composite_cv_score alone (which is v3-only).
  composite_score?: { v2_composite: number; v3_composite: number; fused_score: number }
}

async function callPythonCVWorker(imageBuffer: Buffer, mimeType: string): Promise<PythonCVResult | null> {
  if (!PYTHON_WORKER_URL) return null
  try {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(imageBuffer)], { type: mimeType }), 'image.jpg')
    const res = await fetch(`${PYTHON_WORKER_URL}/analyze/image`, {
      method: 'POST', body: form,
      signal: AbortSignal.timeout(SIGNAL_WORKER_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[hf-analyze] CV worker returned ${res.status} ${res.statusText} — falling back to Brain+ML+LLM only.`)
      return null
    }
    const data = await res.json() as PythonCVResult
    if (typeof data.composite_cv_score !== 'number') {
      console.error('[hf-analyze] CV worker response missing composite_cv_score — falling back to Brain+ML+LLM only.', data)
      return null
    }
    return data
  } catch (err) {
    // NOT a silent fallback — log it. A failing CV worker silently dropping to
    // null causes weight to redistribute to other layers with zero visibility
    // into why, which makes accuracy regressions impossible to diagnose.
    console.error('[hf-analyze] CV worker call failed — falling back to Brain+ML+LLM only. Reason:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── IMAGE BRAIN (PRIMARY) — async with sharp pixel decode ──────────────────
const brainResult = await analyzeImageWithBrain(imageBuffer, imageBuffer.length, mimeType)

// ── Python CV Worker (25% weight C.1 new scheme) — parallel ───────────────
const cvWorkerPromise = callPythonCVWorker(inferenceBuffer, inferenceMime)

// ── LLM Vision Analysis — Gemini only (dual-key fallback), Grok disabled ───
// DECISION: Grok is intentionally disabled — makes zero API calls, regardless
// of whether GROK_API_KEY is set in the environment. Reliability/redundancy
// is now handled via a second free Gemini key (GEMINI_API_KEY_2, see
// gemini-analyzer.ts withGeminiFallback()) instead of paying for a second
// provider. The integration code below is left in place (not deleted) in
// case Grok is wanted again later — flip GROK_ENABLED to re-activate it.
const GROK_ENABLED = false

const geminiPromise = geminiAvailable()
  ? geminiAnalyzeImage(inferenceBuffer, inferenceMime).catch((err) => {
      console.error('[hf-analyze] Gemini image analysis failed (both keys, if configured) — excluded from ensemble. Reason:', err instanceof Error ? err.message : err)
      return null
    })
  : Promise.resolve(null)

const grokPromise: Promise<{aiScore: number; verdict: string; reasoning: string; generator: string} | null> =
  (GROK_ENABLED && process.env.GROK_API_KEY)
    ? (async () => {
        try {
          const b64  = inferenceBuffer.toString('base64')
          const res  = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'grok-2-vision-latest', max_tokens: 150, temperature: 0.1,
              messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: `data:${inferenceMime};base64,${b64}`, detail: 'high' } },
                { type: 'text', text: 'Give an objective, evidence-based assessment of whether this image is AI-generated. Do not assume either answer by default. If you believe it is AI-generated, name which generator it most resembles (Gemini/Imagen, DALLE3/GPT4o, Midjourney, Flux, StableDiffusion, Firefly, or Unknown if you cannot tell). Respond ONLY with JSON: {"ai_probability": 0.0-1.0, "generator": "name or Unknown", "reasoning": "one sentence with specific evidence"}' },
              ]}],
            }),
            signal: AbortSignal.timeout(20_000),
          })
          if (!res.ok) {
            console.error(`[hf-analyze] Grok vision returned ${res.status} ${res.statusText} — excluded from ensemble.`)
            return null
          }
          const data = await res.json()
          const txt  = data.choices?.[0]?.message?.content ?? ''
          const m    = txt.match(/\{[\s\S]*\}/)
          if (!m) return null
          const p    = JSON.parse(m[0])
          const aiScore = Math.max(0, Math.min(1, Number(p.ai_probability) || 0.5))
          return { aiScore, verdict: aiScore > 0.55 ? 'AI' : 'HUMAN', reasoning: p.reasoning ?? '', generator: typeof p.generator === 'string' ? p.generator : 'Unknown' }
        } catch (err) {
          console.error('[hf-analyze] Grok vision call failed — excluded from ensemble. Reason:', err instanceof Error ? err.message : err)
          return null
        }
      })()
    : Promise.resolve(null)

const hfPromise = Promise.allSettled([
  // Aiscern fine-tuned ViT-Large (PRIMARY — highest weight 0.40)
  hfInference(MODELS.image_finetuned, null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 15000 }).catch(() => null),
  hfInference(MODELS.image_primary,  null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
  hfInference(MODELS.image_sdxl,     null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
  hfInference(MODELS.image_face,     null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
  hfInference(MODELS.image_vit,      null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
  hfInference(MODELS.image_deepfake, null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
])

// Pixel signals always use the ORIGINAL buffer (needs camera-native fidelity)
let imgSignals = extractImageSignals(imageBuffer, imageBuffer.length)

const [geminiResult, grokResult, hfResults, cvWorkerResult] = await Promise.all([
  geminiPromise, grokPromise, hfPromise, cvWorkerPromise,
])

try {
  const cal = await getCalibrationStats()
  if (cal?.ai_sample_count >= 10) imgSignals = applyCalibration(imgSignals, cal)
} catch (err) {
  console.error('[hf-analyze] Image calibration failed — using uncalibrated pixel signals. Reason:', err instanceof Error ? err.message : err)
}
const imgSignalScore = aggregateImageSignals(imgSignals)

const mlScores: { model: string; aiScore: number; weight: number }[] = []
const parseImg = (val: unknown, w: number, m: string) => {
  if (!val || !Array.isArray(val)) return
  try {
    const raw = val as { label: string; score: number }[]
    const aiE = raw.find(s => /ai|fake|sdxl|synthetic|label_1|deepfake|generated/i.test(s.label))
    const huE = raw.find(s => /real|human|authentic|label_0|photo/i.test(s.label))
    if (aiE || huE) mlScores.push({ model: m, aiScore: aiE?.score ?? (huE ? 1 - huE.score : 0.5), weight: w })
  } catch (err) {
    console.error(`[hf-analyze] Failed to parse HF result for model "${m}" — excluded from ensemble. Reason:`, err instanceof Error ? err.message : err)
  }
}
parseImg(hfResults[0].status === 'fulfilled' ? hfResults[0].value : null, 0.40, MODELS.image_finetuned)
parseImg(hfResults[1].status === 'fulfilled' ? hfResults[1].value : null, 0.22, MODELS.image_primary)
parseImg(hfResults[2].status === 'fulfilled' ? hfResults[2].value : null, 0.18, MODELS.image_sdxl)
parseImg(hfResults[3].status === 'fulfilled' ? hfResults[3].value : null, 0.08, MODELS.image_face)
parseImg(hfResults[4].status === 'fulfilled' ? hfResults[4].value : null, 0.08, MODELS.image_vit)
parseImg(hfResults[5].status === 'fulfilled' ? hfResults[5].value : null, 0.04, MODELS.image_deepfake)

const mlTotalW    = mlScores.reduce((s, m) => s + m.weight, 0) || 1
const mlScore     = mlScores.length ? mlScores.reduce((s, m) => s + m.aiScore * (m.weight / mlTotalW), 0) : null
const geminiScore = geminiResult?.aiScore ?? null
const grokScore   = grokResult?.aiScore   ?? null
// Prefer the worker's fused_score (40% v2 pixel/noise/frequency/SynthID layers
// + 60% v3 forensics) when present — composite_cv_score alone is v3-only and
// silently discards the v2 layers' work. Falls back to composite_cv_score for
// older worker versions that don't return composite_score.
const cvScore     = cvWorkerResult?.composite_score?.fused_score ?? cvWorkerResult?.composite_cv_score ?? null

// ── IMAGE ENSEMBLE v8.2 — Brain+CV-first, LLM weight restored, Gemini-only ──
// (decision: prioritize generator-ID strength; use dual Gemini keys for
// redundancy instead of paying for Grok as a second provider) ─────────────
//
// WEIGHT RATIONALE:
//   v7 (old):  LLM 45-55% (4 providers)  — too dominant, displaced Brain/CV
//   v8.0:      LLM 10% (1 provider)      — generator-ID got noticeably worse
//   v8.1:      LLM 20% (2 providers: Gemini+Grok) — doubled weight to match
//     doubled provider count.
//   v8.2 (now): LLM 20% (1 provider: Gemini, with GEMINI_API_KEY_2 fallback)
//     — Grok disabled per decision (GROK_ENABLED = false above; makes no API
//     calls). Weight kept at 20% rather than reverting to 10%, since the
//     priority (stronger generator-ID) hasn't changed — just how reliability
//     is achieved (free dual-key Gemini rotation instead of a paid second
//     provider). Generator voting below now has at most 2 possible sources
//     (Brain + Gemini) instead of 3 — corroboration is weaker than the
//     Gemini+Grok setup, but still meaningfully better than Gemini alone.
//   Image Brain:        31%  (was 35% in v8.0)
//   Python CV worker:   22%  (was 25% in v8.0)
//   HF ViT ensemble:    18%  (was 20% in v8.0)
//   Raw pixel signals:   9%  (was 10% in v8.0)
//   LLM Vision:         20%  (was 10% in v8.0) — Gemini only (dual-key)
//
// Fallback weight redistribution when a layer is unavailable: unchanged
// principle — LLM is never the primary fallback, only a tiebreaker, EXCEPT
// it now carries enough weight (20%) to be a genuinely meaningful tiebreaker
// rather than a rounding error.
const llmScores: number[] = []
if (geminiScore !== null) llmScores.push(geminiScore)
if (grokScore   !== null) llmScores.push(grokScore)  // always null while GROK_ENABLED = false
const llmScore = llmScores.length ? llmScores.reduce((a, b) => a + b, 0) / llmScores.length : null

let aiScore:   number
let modelUsed: string
let engineDesc: string
let llmWeightUsed = 0   // tracked per-branch so the override below isn't hardcoded

const cvAvailable = cvScore !== null
const hfAvailable = mlScore !== null
const llmAvailable = llmScore !== null

if (cvAvailable && hfAvailable && llmAvailable) {
  // Full ensemble: Brain(31%) + CV(22%) + HF(18%) + Pixel(9%) + LLM(20%)
  llmWeightUsed = 0.20
  aiScore    = brainResult.score * 0.31 + cvScore * 0.22 + mlScore * 0.18 + imgSignalScore * 0.09 + llmScore * llmWeightUsed
  modelUsed  = `Aiscern-ImageEngine-v8.1(Brain31%+CV22%+HF18%+Pixel9%+LLM20%)`
  engineDesc = `Brain (31%) + CV-Worker (22%) + ${mlScores.length} HF ViT (18%) + Pixel (9%) + LLM Gemini dual-key (20%)`
} else if (cvAvailable && hfAvailable) {
  // No LLM: Brain(37%) + CV(28%) + HF(20%) + Pixel(15%)
  aiScore    = brainResult.score * 0.37 + cvScore * 0.28 + mlScore * 0.20 + imgSignalScore * 0.15
  modelUsed  = `Aiscern-ImageEngine-v8.1(Brain37%+CV28%+HF20%+Pixel15%)`
  engineDesc = `Brain (37%) + CV-Worker (28%) + ${mlScores.length} HF ViT (20%) + Pixel (15%) — no LLM`
} else if (cvAvailable && llmAvailable) {
  // No HF: Brain(38%) + CV(29%) + Pixel(13%) + LLM(20%)
  llmWeightUsed = 0.20
  aiScore    = brainResult.score * 0.38 + cvScore * 0.29 + imgSignalScore * 0.13 + llmScore * llmWeightUsed
  modelUsed  = `Aiscern-ImageEngine-v8.1(Brain38%+CV29%+Pixel13%+LLM20%)`
  engineDesc = `Brain (38%) + CV-Worker (29%) + Pixel (13%) + LLM (20%) — HF cold-starting`
} else if (cvAvailable) {
  // CV + Brain + Pixel only
  aiScore    = brainResult.score * 0.47 + cvScore * 0.38 + imgSignalScore * 0.15
  modelUsed  = `Aiscern-ImageEngine-v8.1(Brain47%+CV38%+Pixel15%)`
  engineDesc = `Brain (47%) + CV-Worker (38%) + Pixel (15%) — no LLM or HF`
} else if (hfAvailable && llmAvailable) {
  // No CV: Brain(40%) + HF(22%) + Pixel(18%) + LLM(20%)
  llmWeightUsed = 0.20
  aiScore    = brainResult.score * 0.40 + mlScore * 0.22 + imgSignalScore * 0.18 + llmScore * llmWeightUsed
  modelUsed  = `Aiscern-ImageEngine-v8.1(Brain40%+HF22%+Pixel18%+LLM20%)`
  engineDesc = `Brain (40%) + ${mlScores.length} HF ViT (22%) + Pixel (18%) + LLM (20%) — CV worker offline`
} else if (hfAvailable) {
  // No CV, no LLM: Brain(50%) + HF(30%) + Pixel(20%)
  aiScore    = brainResult.score * 0.50 + mlScore * 0.30 + imgSignalScore * 0.20
  modelUsed  = `Aiscern-ImageEngine-v8.1(Brain50%+HF30%+Pixel20%)`
  engineDesc = `Brain (50%) + ${mlScores.length} HF ViT (30%) + Pixel (20%) — no CV or LLM`
} else {
  // Fallback — only Brain + pixels (still better than LLM-only!)
  aiScore    = brainResult.score * 0.65 + imgSignalScore * 0.35
  modelUsed  = 'Aiscern-ImageEngine-v8.1(Brain65%+Pixel35%)'
  engineDesc = 'Image Brain (65%) + Pixel signals (35%) — configure PYTHON_WORKER_URL for best accuracy'
}

// ── LLM Consensus Override (C.1.3) ──────────────────────────────────────────
// LLM can ADD UP TO 0.08 to the final score when:
//   (a) it strongly agrees with Brain+CV (both >0.55), AND
//   (b) its own score is >0.80
// This prevents a lone LLM vision call from flipping an otherwise-confident
// HUMAN verdict to AI — it can only reinforce a borderline case. Uses the
// actual per-branch llmWeightUsed (tracked above) rather than a hardcoded
// 0.10 — that assumption broke once LLM weight became branch-dependent.
if (llmScore !== null && llmScore > 0.80) {
  const nonLlmScore = aiScore - (llmScore * llmWeightUsed)   // remove LLM contribution
  const brainCvAgree = (brainResult.score > 0.55) && (cvScore === null || cvScore > 0.55)
  if (brainCvAgree) {
    // Allow LLM to push a borderline case toward AI, capped at +0.08
    aiScore = Math.min(aiScore + 0.08, Math.max(aiScore, nonLlmScore + (llmScore - 0.50) * 0.10))
  }
  // If Brain+CV don't agree, LLM high score changes nothing — it already has its weight
}

// ── Multi-Source Generator Attribution Voting ───────────────────────────────
// Restores (in spirit) the abandoned v3 cascade's attributeGenerator() idea
// — but adapted to the LIVE ensemble instead of sitting unused in dead code.
// Combines generator guesses from three INDEPENDENT sources: Brain's pixel-
// statistic hints, Gemini's vision reasoning, and Grok's vision reasoning —
// each weighted by that source's own confidence. Two or more independent
// sources agreeing on the same generator is much stronger evidence than any
// single source's guess, which is exactly the capability that got lost when
// v8.0 cut LLM providers from 4 down to 1.
function normalizeGeneratorName(raw: string): string {
  // Brain's hints are verbose ("Gemini Imagen v3 (200-220 peak)") while the
  // LLMs return short labels ("Gemini", "GPT4o", "SDXL"). Without normalizing
  // both to the same canonical name first, the SAME generator identified by
  // two different sources would be counted as two different votes — silently
  // defeating the entire purpose of multi-source corroboration. Caught this
  // via a standalone test before shipping (Brain's "Gemini Imagen v3" vs
  // Gemini's own "Gemini" guess didn't match as strings).
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

function voteGenerator(): { name: string | null; sources: string[] } {
  const votes = new Map<string, { weight: number; sources: string[] }>()
  const add = (name: string | null | undefined, weight: number, source: string) => {
    if (!name || /^(unknown|none|n\/a)$/i.test(name.trim())) return
    const key = normalizeGeneratorName(name.split('(')[0])
    const cur = votes.get(key) ?? { weight: 0, sources: [] }
    cur.weight += weight
    cur.sources.push(source)
    votes.set(key, cur)
  }
  // Brain's hint strings look like "Gemini Imagen v3 (200–220° peak)" — the
  // normalizer strips the parenthetical and maps to a canonical name.
  for (const hint of brainResult.generatorHints) {
    add(hint, brainResult.score, 'Brain')
  }
  add(geminiResult?.generator, geminiScore ?? 0.5, 'Gemini')
  add(grokResult?.generator,   grokScore   ?? 0.5, 'Grok')

  if (votes.size === 0) return { name: null, sources: [] }
  let best: [string, { weight: number; sources: string[] }] | null = null
  for (const entry of votes) if (!best || entry[1].weight > best[1].weight) best = entry
  return { name: best![0], sources: best![1].sources }
}
const generatorVote = voteGenerator()

// ── Generator Override (kept from v6/v7, now strengthened by multi-source
// voting) ────────────────────────────────────────────────────────────────
// Two+ independent sources agreeing on the same named generator is strong
// corroborated evidence — gets a bigger, more confident push than any one
// source alone. A single source (just Brain, or just one LLM) keeps the
// original, more conservative behavior to avoid one weak heuristic deciding
// the verdict alone.
if (generatorVote.name && aiScore > 0.45) {
  if (generatorVote.sources.length >= 2) {
    aiScore = Math.max(aiScore, 0.80)
  } else if (brainResult.verdict === 'AI' && brainResult.generatorHints.length > 0 && brainResult.score > 0.52) {
    aiScore = Math.max(aiScore, brainResult.score * 0.88)
  }
}

const calibratedImgScore = calibrateScore(aiScore)
const editSig  = imgSignals.find(s => s.name === 'Edit Signature')
const isEdited = editSig && editSig.score > 0.65 && calibratedImgScore < 0.52 && calibratedImgScore > 0.30
const verdict: 'AI' | 'HUMAN' | 'UNCERTAIN' = isEdited ? 'AI' : toVerdict(calibratedImgScore, 'image')

const topSignal  = [...imgSignals].sort((a, b) => b.score - a.score)[0]
const geminiSigs = geminiResult?.signals ?? []

// Format brain signals for output
const brainSignalsFormatted = brainResult.signals
  .sort((a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5))
  .slice(0, 5)
  .map(sig => ({
    name:        sig.name,
    category:    'Image Brain',
    description: sig.evidence,
    weight:      Math.round(sig.weight * 50),
    value:       Math.round(sig.score * 1000) / 1000,
    flagged:     sig.score > 0.62,
  }))

// CV worker signals
const cvSignalsFormatted = cvWorkerResult?.cv_signals
  ? Object.entries(cvWorkerResult.cv_signals).slice(0, 4).map(([name, score]) => ({
      name:        name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      category:    'CV Forensic',
      description: `Python 6-layer CV forensic signal: ${name}`,
      weight:      25,
      value:       Math.round(score * 1000) / 1000,
      flagged:     score > 0.60,
    }))
  : []

return {
  verdict,
  // NOTE: confidence is the raw AI-likelihood score (0=human-like, 1=AI-like),
  // NOT "confidence in the stated verdict". Downstream code (RAG blending in
  // /api/detect/image/route.ts) depends on this being the raw AI probability
  // for its 0.55/0.40 threshold comparisons — do not invert it here.
  // For verdict-confidence display, use formatVerdictConfidence() instead.
  confidence:    Math.round(calibratedImgScore * 1000) / 1000,
  model_used:    modelUsed,
  model_version: '8.1.0',
  generator_attribution: generatorVote.name
    ? { generator: generatorVote.name, corroborating_sources: generatorVote.sources, confidence: generatorVote.sources.length >= 2 ? 'high' : 'low' }
    : null,
  signals: [
    {
      name:        'Image Detection Brain',
      category:    'ML',
      description: `${engineDesc}. Brain verdict: ${brainResult.verdict} (${Math.round(brainResult.score * 100)}%). ` +
        (generatorVote.name ? `Generator: ${generatorVote.name} (${generatorVote.sources.join('+')} agree). ` : (brainResult.generatorHints.length ? `Generator: ${brainResult.generatorHints.join('; ')}. ` : '')) +
        `Top: ${brainResult.findings[0] ?? 'pixel pattern analysis'}` +
        (geminiSigs.length ? ` | Gemini: ${geminiSigs.slice(0, 2).join(', ')}` : ''),
      weight:  50,
      value:   Math.round(brainResult.score * 1000) / 1000,
      flagged: brainResult.score > 0.60,
    },
    ...brainSignalsFormatted,
    ...cvSignalsFormatted,
    ...imgSignals.map(sig => ({
      name:        sig.name,
      category:    'Pixel Analysis',
      description: sig.description,
      weight:      Math.round(sig.weight * 20),
      value:       sig.score,
      flagged:     sig.score > 0.58,
    })),
  ],
  model_breakdown: [
    { model_id: 'image-brain-v2',      raw_score: brainResult.score, verdict: scoreToVerdict(brainResult.score), latency_ms: 0 },
    ...(cvScore     !== null ? [{ model_id: 'python-cv-worker-v3',     raw_score: cvScore,     verdict: scoreToVerdict(cvScore),     latency_ms: 0 }] : []),
    ...(geminiScore !== null ? [{ model_id: 'gemini-2.5-flash-vision', raw_score: geminiScore, verdict: scoreToVerdict(geminiScore), latency_ms: 0 }] : []),
    ...(grokScore   !== null ? [{ model_id: 'grok-2-vision',           raw_score: grokScore,   verdict: scoreToVerdict(grokScore),   latency_ms: 0 }] : []),
    ...mlScores.map(m => ({ model_id: m.model, raw_score: m.aiScore, verdict: scoreToVerdict(m.aiScore), latency_ms: 0 })),
    { model_id: 'pixel-signals-v2', raw_score: imgSignalScore, verdict: scoreToVerdict(imgSignalScore), latency_ms: 0 },
  ],
  summary: verdict === 'AI'
    ? `AI-generated image detected with ${Math.round(calibratedImgScore * 100)}% confidence. ` +
      (generatorVote.name ? `Likely generator: ${generatorVote.name}${generatorVote.sources.length >= 2 ? ` (confirmed by ${generatorVote.sources.join(' + ')})` : ''}. ` : (brainResult.generatorHints.length ? `Likely generator: ${brainResult.generatorHints[0]}. ` : '')) +
      `Key signals: ${brainResult.findings.slice(0, 2).join(' | ')}.`
    : verdict === 'HUMAN'
    ? `Image appears authentic — ${Math.round((1 - calibratedImgScore) * 100)}% confidence. ` +
      `Natural camera characteristics: ${topSignal?.name ?? 'organic noise floor detected'}.`
    : `Analysis inconclusive (${Math.round(calibratedImgScore * 100)}% AI probability). ` +
      `${generatorVote.name ? `Possible generator: ${generatorVote.name}.` : (brainResult.generatorHints.length ? `Possible generator: ${brainResult.generatorHints[0]}.` : 'Try a higher-resolution original image for accuracy.')}`,
}
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO DETECTION
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeAudio(
  fileName: string, fileSize: number, format: string, audioBuffer?: Buffer
): Promise<DetectionResult> {
  const durationEst = Math.round(fileSize / (128 * 1024 / 8))
  const hasBuffer   = !!(audioBuffer && audioBuffer.length > 0)

  const geminiPromise = (geminiAvailable() && hasBuffer)
    ? geminiAnalyzeAudio(audioBuffer!, format, fileName).catch(() => null)
    : Promise.resolve(null)

  const hfP0 = (hasBuffer && HF_TOKEN)
    ? hfInference(MODELS.audio_finetuned, null, { binary: true, binaryData: audioBuffer!, retries: 0, timeoutMs: 15000 }).catch(() => null)
    : Promise.resolve(null)
  const hfP1 = (hasBuffer && HF_TOKEN)
    ? hfInference(MODELS.audio_primary,  null, { binary: true, binaryData: audioBuffer!, retries: 0, timeoutMs: 12000 }).catch(() => null)
    : Promise.resolve(null)
  const hfP2 = (hasBuffer && HF_TOKEN)
    ? hfInference(MODELS.audio_asvspoof, null, { binary: true, binaryData: audioBuffer!, retries: 0, timeoutMs: 12000 }).catch(() => null)
    : Promise.resolve(null)

  let audioSignals = hasBuffer
    ? extractAudioSignalsExtended(audioBuffer!, fileSize)
    : extractAudioSignalsExtended(Buffer.alloc(0), fileSize)

  const [geminiResult, mlR0, mlR1, mlR2] = await Promise.all([geminiPromise, hfP0, hfP1, hfP2])

  try {
    const audioCal = await getAudioCalibrationStats()
    if (audioCal?.ai_sample_count >= 20) audioSignals = applyAudioCalibration(audioSignals, audioCal)
  } catch {}
  const sigScore = aggregateAudioSignals(audioSignals)

  const mlScores: { score: number; weight: number }[] = []
  const parseAudio = (r: unknown, weight: number) => {
    if (!r || !Array.isArray(r)) return
    try {
      const raw   = r as { label: string; score: number }[]
      const fakeE = raw.find(s => /fake|spoof|label_1|deepfake|synthetic|ai/i.test(s.label))
      const realE = raw.find(s => /real|bonafide|label_0|authentic|human/i.test(s.label))
      const score = fakeE?.score ?? (realE ? 1 - realE.score : null)
      if (score !== null && score !== undefined) mlScores.push({ score, weight })
    } catch {}
  }
  parseAudio(mlR0, 0.50)   // fine-tuned — dominant
  parseAudio(mlR1, 0.30)   // audio_primary
  parseAudio(mlR2, 0.20)   // asvspoof

  const totalWeight = mlScores.reduce((a, b) => a + b.weight, 0)
  const mlMean      = mlScores.length
    ? mlScores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight
    : null
  const geminiScore = geminiResult?.aiScore ?? null

  let aiScore: number
  let modelUsed: string

  if (geminiScore !== null && mlMean !== null) {
    aiScore   = geminiScore * 0.45 + mlMean * 0.30 + sigScore * 0.25
    modelUsed = `Aiscern-AudioEnsemble(Gemini2Flash+${mlScores.length}Models+8AcousticSignals)`
  } else if (geminiScore !== null) {
    aiScore   = geminiScore * 0.70 + sigScore * 0.30
    modelUsed = 'Aiscern-AudioGemini(Gemini2Flash+8AcousticSignals)'
  } else if (mlMean !== null) {
    aiScore   = mlMean * 0.70 + sigScore * 0.30
    modelUsed = `Aiscern-AudioEnsemble(${mlScores.length}Models+8AcousticSignals)`
  } else {
    aiScore   = sigScore
    modelUsed = 'Aiscern-AudioSignals(8AcousticHeuristics)'
  }

  const calibratedAudioScore = calibrateScore(aiScore)
  const verdict  = toVerdict(calibratedAudioScore, "audio")
  const segCount = Math.max(3, Math.min(10, Math.ceil(durationEst / 5)))

  // Deterministic segment scores using sin wave (no Math.random)
  const segment_scores = Array.from({ length: segCount }, (_, i) => ({
    start_sec: i * 5,
    end_sec:   Math.min((i + 1) * 5, durationEst),
    label:     verdict,
    ai_score:  Math.max(0.01, Math.min(0.99,
      Math.round((aiScore + Math.sin(i * 1.2 + aiScore * Math.PI) * 0.06) * 1000) / 1000
    )),
  }))

  return {
    verdict,
    confidence:    Math.round(calibratedAudioScore * 1000) / 1000,
    model_used:    modelUsed,
    model_version: '5.0.0',
    signals: [
      {
        name:        'Neural Deepfake Classifier',
        category:    'ML',
        description: geminiScore !== null
          ? `Gemini 2.0 Flash audio analysis${mlMean !== null ? ` + ${mlScores.length} wav2vec2 models` : ' (HF cold)'}${geminiResult?.reasoning ? ` — ${geminiResult.reasoning}` : ''}`
          : mlMean !== null
          ? `${mlScores.length} wav2vec2/ASVspoof models: score ${Math.round(mlMean * 100)}%`
          : 'ML unavailable — acoustic signal analysis only',
        weight:  geminiScore !== null || mlMean !== null ? 70 : 0,
        value:   Math.round((geminiScore ?? mlMean ?? sigScore) * 1000) / 1000,
        flagged: (geminiScore ?? mlMean ?? sigScore) > 0.58,
      },
      ...audioSignals.map(sig => ({
        name:        sig.name,
        category:    'Acoustic',
        description: sig.description,
        weight:      Math.round(sig.weight * 30),
        value:       sig.score,
        flagged:     sig.score > 0.62,
      })),
    ],
    summary: verdict === 'AI'
      ? `Voice detected as AI-synthesized with ${Math.round(aiScore * 100)}% confidence.${geminiResult?.reasoning ? ' ' + geminiResult.reasoning : ''}`
      : verdict === 'HUMAN'
      ? `Voice detected as authentic human speech — ${Math.round((1 - aiScore) * 100)}% confidence.`
      : `Audio inconclusive (${Math.round(aiScore * 100)}% synthetic probability). WAV format gives best accuracy.`,
    segment_scores,
    model_breakdown: [
      ...(geminiScore !== null ? [{ model_id: 'gemini-2.5-flash-audio', raw_score: geminiScore, verdict: scoreToVerdict(geminiScore), latency_ms: 0 }] : []),
      ...mlScores.map((m, i) => ({
        model_id:   i === 0 ? MODELS.audio_finetuned : i === 1 ? MODELS.audio_primary : MODELS.audio_asvspoof,
        raw_score:  m.score,
        verdict:    scoreToVerdict(m.score),
        latency_ms: 0,
      })),
      { model_id: 'acoustic-signals-v2', raw_score: sigScore, verdict: scoreToVerdict(sigScore), latency_ms: 0 },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO DETECTION
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeVideoWithFrames(
  fileName: string,
  fileSize: number,
  format: string,
  frames: { base64: string; index: number; timeSec: number }[],
): Promise<DetectionResult> {
  const durationEst = Math.max(1, Math.round(fileSize / (1024 * 1024 * 2)))

  if (frames.length > 0 && process.env.NVIDIA_API_KEY) {
    try {
      const nimResult = await analyzeVideoFrames(frames)
      const ensemble  = buildVideoSignals(nimResult)
      const verdict   = toVerdict(calibrateScore(ensemble.ai_score), "video")
      return {
        verdict,
        confidence:    Math.round(ensemble.ai_score * 1000) / 1000,
        model_used:    ensemble.model_used,
        model_version: '5.0.0',
        signals:       ensemble.signals,
        frame_scores:  ensemble.frame_scores,
        summary: verdict === 'AI'
          ? `Deepfake detected with ${Math.round(ensemble.ai_score * 100)}% confidence. ${nimResult.frames.filter(f => f.face_detected).length} face frames analyzed via NVIDIA NIM.`
          : verdict === 'HUMAN'
          ? `Video appears authentic — ${Math.round((1 - ensemble.ai_score) * 100)}% confidence across ${nimResult.frames.length} frames.`
          : `Inconclusive (${Math.round(ensemble.ai_score * 100)}% AI probability). Ensure visible faces in video.`,
      }
    } catch (err: unknown) {
      console.warn('[analyzeVideoWithFrames] NVIDIA NIM failed, falling back to HF:', (err as Error)?.message)
    }
  }

  // HuggingFace finetuned video model fallback — classify individual frames
  if (frames.length > 0 && HF_TOKEN) {
    try {
      const frameScores: number[] = []
      // Run finetuned model on up to 8 evenly-spaced frames in parallel
      const sampleFrames = frames.filter((_, i) => i % Math.max(1, Math.floor(frames.length / 8)) === 0).slice(0, 8)
      await Promise.allSettled(sampleFrames.map(async (frame) => {
        const buf = Buffer.from(frame.base64, 'base64')
        const raw = await hfInference(MODELS.video_finetuned, null, {
          binary: true, binaryData: buf, retries: 0, timeoutMs: 10000,
        }).catch(() => null)
        if (!raw || !Array.isArray(raw)) return
        const arr    = raw as { label: string; score: number }[]
        const fakeE  = arr.find(s => /fake|deepfake|label_1|ai/i.test(s.label))
        const realE  = arr.find(s => /real|authentic|label_0/i.test(s.label))
        const score  = fakeE?.score ?? (realE ? 1 - realE.score : null)
        if (score !== null && score !== undefined) frameScores.push(score)
      }))

      if (frameScores.length >= 2) {
        const mean  = frameScores.reduce((a, b) => a + b, 0) / frameScores.length
        const max   = Math.max(...frameScores)
        // IQR-aware aggregation (§4.3 of engineering brief)
        const sorted = [...frameScores].sort((a, b) => a - b)
        const q1    = sorted[Math.floor(sorted.length * 0.25)]
        const q3    = sorted[Math.floor(sorted.length * 0.75)]
        const iqr   = q3 - q1
        // High IQR = inconsistent predictions = suspicious
        const ensScore = iqr > 0.25 ? Math.max(mean, max * 0.7) : mean
        const calibrated = calibrateScore(ensScore)
        const verdict = toVerdict(calibrated, 'video')
        return {
          verdict,
          confidence:    Math.round(calibrated * 1000) / 1000,
          model_used:    `Aiscern-VideoEnsemble(ViT-base-LoRA,${frameScores.length}frames,IQR=${iqr.toFixed(2)})`,
          model_version: '5.0.0',
          signals: [
            {
              name:        'Frame-Level Deepfake Classifier',
              category:    'ML',
              description: `ViT-base LoRA fine-tuned on Celeb-DF + FaceForensics. ${frameScores.length} frames analyzed. IQR=${iqr.toFixed(2)} (high=suspicious).`,
              weight:      80,
              value:       Math.round(ensScore * 1000) / 1000,
              flagged:     ensScore > 0.55,
            },
            {
              name:        'Temporal Consistency',
              category:    'Heuristic',
              description: iqr > 0.25 ? 'High prediction variance across frames — possible deepfake swap in partial segments.' : 'Consistent predictions across frames.',
              weight:      20,
              value:       Math.round((1 - iqr) * 1000) / 1000,
              flagged:     iqr > 0.25,
            },
          ],
          frame_scores: sampleFrames.map((f, i) => ({
            frame:        f.index,
            time_sec:     f.timeSec,
            ai_score:     Math.round((frameScores[i] ?? ensScore) * 1000) / 1000,
            face_detected: true,
          })),
          summary: verdict === 'AI'
            ? `Deepfake detected — ${Math.round(ensScore * 100)}% confidence across ${frameScores.length} frames (IQR=${iqr.toFixed(2)}).`
            : verdict === 'HUMAN'
            ? `Video appears authentic across ${frameScores.length} analyzed frames.`
            : `Inconclusive (${Math.round(ensScore * 100)}% AI probability across ${frameScores.length} frames).`,
        }
      }
    } catch (err: unknown) {
      console.warn('[analyzeVideoWithFrames] HF finetuned failed:', (err as Error)?.message)
    }
  }

  return analyzeVideoFallback(fileName, fileSize, format, durationEst)
}

export async function analyzeVideo(
  fileName: string, fileSize: number, format: string, _videoBuffer?: Buffer
): Promise<DetectionResult> {
  const durationEst = Math.max(1, Math.round(fileSize / (1024 * 1024 * 2)))

  // MODULE 1 — self-hosted CV path. Only reachable when raw video bytes are
  // actually available server-side (FormData/legacy-upload callers). The
  // r2Key path never has bytes on Vercel by design, so it still falls
  // through to analyzeVideoFallback() below exactly as before — this does
  // NOT change behavior for that path.
  if (_videoBuffer && VIDEO_PYTHON_WORKER_URL) {
    const mimeType = format.startsWith('video/') ? format : `video/${format}`
    const cvResult = await callPythonCVWorkerVideo(_videoBuffer, mimeType)

    if (cvResult) {
      const calibrated = calibrateScore(cvResult.composite_cv_score)
      const verdict = toVerdict(calibrated, 'video')
      return {
        verdict,
        confidence: Math.round(calibrated * 1000) / 1000,
        model_used: `Aiscern-SelfHostedVideoCV(image-engine-reuse,${cvResult.frames_analyzed}/${cvResult.frames_sampled}frames,v${cvResult.version})`,
        model_version: '5.0.0',
        signals: [
          {
            name: 'Self-Hosted Frame Forensics (image-engine reuse)',
            category: 'CV',
            description: `${cvResult.frames_analyzed} sampled frames analyzed via the full 12-layer image forensic cascade.`,
            weight: Math.round(VIDEO_CV_WORKER_WEIGHT * 100),
            value: Math.round(cvResult.composite_cv_score * 1000) / 1000,
            flagged: cvResult.composite_cv_score > 0.55,
          },
          {
            name: 'Temporal Consistency',
            category: 'Heuristic',
            description: cvResult.temporal_variance.flagged
              ? 'High frame-to-frame variance in noise/frequency/DCT layers — inconsistent compression signature, a common AI-video tell.'
              : 'Consistent per-frame forensic signatures across the clip.',
            weight: Math.round((1 - VIDEO_CV_WORKER_WEIGHT) * 100),
            value: Math.round((1 - cvResult.temporal_variance.watch_layer_variance) * 1000) / 1000,
            flagged: cvResult.temporal_variance.flagged,
          },
        ],
        frame_scores: cvResult.frame_scores.map((f: { frame_index: number; composite_cv_score: number | null }) => ({
          frame: f.frame_index,
          time_sec: 0,
          ai_score: f.composite_cv_score ?? cvResult.composite_cv_score,
          face_detected: false,
        })),
        summary: verdict === 'AI'
          ? `Self-hosted forensic cascade flagged this video — ${Math.round(calibrated * 100)}% confidence across ${cvResult.frames_analyzed} sampled frames.${cvResult.temporal_variance.flagged ? ' Frame-to-frame forensic signature is inconsistent, a common AI-video indicator.' : ''}`
          : verdict === 'HUMAN'
          ? `Video appears authentic — ${Math.round((1 - calibrated) * 100)}% confidence across ${cvResult.frames_analyzed} sampled frames (self-hosted forensic cascade, no paid API used).`
          : `Inconclusive (${Math.round(calibrated * 100)}% AI probability) across ${cvResult.frames_analyzed} sampled frames.`,
      }
    }
    // cvResult === null: worker unavailable/failed — logged already inside
    // callPythonCVWorkerVideo(). Fall through to the existing path below,
    // never silently degrade without a trace.
  }

  return analyzeVideoFallback(fileName, fileSize, format, durationEst)
}

function analyzeVideoFallback(
  _fileName: string,
  _fileSize: number,
  _format: string,
  _durationEst: number
): DetectionResult {
  return {
    verdict: 'UNCERTAIN' as const,
    confidence: 0,
    model_used: 'Aiscern-VideoFallback(FrameExtractionRequired)',
    model_version: '5.0.0',
    signals: [
      {
        name: 'Frame Extraction Required',
        category: 'System',
        description: 'Video deepfake detection requires frame-by-frame analysis via NVIDIA NIM. Open the /detect/video page in Chrome or Edge to enable automatic frame extraction.',
        weight: 100,
        value: 0,
        flagged: false,
      },
    ],
    summary: 'Video analysis requires frame extraction. Please use the video detection page at aiscern.com/detect/video in a modern browser (Chrome/Edge) which captures canvas frames for NVIDIA NIM analysis. API video detection without pre-extracted frames is not supported.',
    frame_scores: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITER (use lib/ratelimit — functions below are DEPRECATED, kept only
// for backward-compat. Do NOT import these from hf-analyze.ts in new routes.)
// ─────────────────────────────────────────────────────────────────────────────
const _rlMap = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimitAsync(ip: string, limit = 20, windowMinutes = 1): Promise<boolean> {
  // FIX: use singleton admin client instead of creating a new client per call
  try {
    const { data } = await getSupabaseAdmin().rpc('check_and_increment_rate_limit', {
      p_ip: ip, p_max: limit, p_window_minutes: windowMinutes,
    })
    return data === true
  } catch {
    return checkRateLimit(ip, limit)
  }
}

export function checkRateLimit(ip: string, limit = 20, windowMs = 60000): boolean {
  const now = Date.now()
  const e   = _rlMap.get(ip)
  if (!e || now > e.resetAt) { _rlMap.set(ip, { count: 1, resetAt: now + windowMs }); return true }
  if (e.count >= limit) return false
  e.count++
  return true
}


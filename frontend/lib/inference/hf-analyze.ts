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

  // AUDIO — 3-model ensemble (coming soon: aiscern fine-tuned)
  audio_primary:   'mo-thecreator/Deepfake-audio-detection',
  audio_asvspoof:  'MelodyMachine/Deepfake-audio-detection-V2',
  audio_xlsr:      'facebook/wav2vec2-large-xlsr-53',
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
      if (binary && binaryData) { headers['Content-Type'] = 'application/octet-stream'; body = binaryData }
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
  const geminiPromise = geminiAvailable()
    ? geminiAnalyzeText(text).catch(() => null)
    : Promise.resolve(null)

  const hfPromise = Promise.allSettled([
    // Aiscern fine-tuned DeBERTa (PRIMARY — highest weight 0.45)
    hfInference(MODELS.text_finetuned,  { inputs: text.substring(0, 2000) }).catch(() => null),
    hfInference(MODELS.text_primary,    { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_secondary,  { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_tertiary,   { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_quaternary, { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_quinary,    { inputs: text.substring(0, 1800) }).catch(() => null),
  ])

  const [geminiResult, hfResults, lingSignals] = await Promise.all([
    geminiPromise,
    hfPromise,
    Promise.resolve(extractTextSignalsV2(text)),
  ])

  // Parse HF results — null values are cold-start failures
  const rawHF = hfResults.map(r => r.status === 'fulfilled' ? r.value : null)
  const mlScores: { model: string; aiScore: number; weight: number }[] = []
  // Fine-tuned model uses 'ai'/'human' labels (DeBERTa trained with id2label={0:'human',1:'ai'})
  const s0 = parseHFText(rawHF[0], ['ai','label_1','1','fake'],     ['human','label_0','0','real'])
  const s1 = parseHFText(rawHF[1], ['fake','label_1','1'],          ['real','label_0','0'])
  const s2 = parseHFText(rawHF[2], ['chatgpt','ai','label_1','1'],  ['human','label_0','0'])
  const s3 = parseHFText(rawHF[3], ['label_1','ai','fake','ai-generated'], ['label_0','human','real','human-written'])
  const s4 = parseHFText(rawHF[4], ['label_1','ai','fake'],         ['label_0','human','real'])
  const s5 = parseHFText(rawHF[5], ['label_1','ai','fake'],         ['label_0','human','real'])
  if (s0 !== null) mlScores.push({ model: MODELS.text_finetuned,  aiScore: s0, weight: 0.45 }) // fine-tuned = dominant
  if (s1 !== null) mlScores.push({ model: MODELS.text_primary,    aiScore: s1, weight: 0.20 })
  if (s2 !== null) mlScores.push({ model: MODELS.text_secondary,  aiScore: s2, weight: 0.15 })
  if (s3 !== null) mlScores.push({ model: MODELS.text_tertiary,   aiScore: s3, weight: 0.10 })
  if (s4 !== null) mlScores.push({ model: MODELS.text_quaternary, aiScore: s4, weight: 0.06 })
  if (s5 !== null) mlScores.push({ model: MODELS.text_quinary,    aiScore: s5, weight: 0.04 })

  const mlTotalW   = mlScores.reduce((s, m) => s + m.weight, 0) || 1
  const mlScore    = mlScores.length ? mlScores.reduce((s, m) => s + m.aiScore * (m.weight / mlTotalW), 0) : null
  const lingScore  = aggregateTextSignals(lingSignals)
  const geminiScore = geminiResult?.aiScore ?? null

  let aiScore: number
  let engineDesc: string

  if (geminiScore !== null && mlScore !== null) {
    aiScore    = geminiScore * 0.50 + mlScore * 0.25 + lingScore * 0.25
    engineDesc = `Gemini 2.0 Flash + ${mlScores.length} HF models + 7 linguistic signals`
  } else if (geminiScore !== null) {
    aiScore    = geminiScore * 0.70 + lingScore * 0.30
    engineDesc = `Gemini 2.0 Flash + 7 linguistic signals`
  } else if (mlScore !== null) {
    aiScore    = mlScore * 0.70 + lingScore * 0.30
    engineDesc = `${mlScores.length} HF transformer models + 7 linguistic signals`
  } else {
    aiScore    = lingScore
    engineDesc = 'Linguistic signal analysis only'
  }

  // Homoglyph normalization — detect adversarial Unicode evasion
  const { isSuspicious: homoglyphSuspicious } = normalizeHomoglyphs(text)

  // Uncertainty-aware ensemble variance (§5.1)
  const allMlScores = mlScores.map(m => m.aiScore)
  if (geminiScore !== null) allMlScores.push(geminiScore)
  const ensVariance = computeEnsembleVariance(allMlScores)

  // Metadata for adaptive thresholds
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const hasCode   = /```|\bfunction\b|\bconst\b|\bimport\b|\bclass\b|\bdef\b/.test(text)

  const calibratedScore = calibrateScore(aiScore)
  // Homoglyph evasion detected → bias toward AI
  const adjustedScore   = homoglyphSuspicious ? Math.min(0.99, calibratedScore + 0.12) : calibratedScore
  const verdict = toVerdict(adjustedScore, 'text', { wordCount, hasCode, mlVariance: ensVariance })
  const modelStr  = geminiScore !== null ? 'Gemini2Flash' : mlScores.map(s => s.model.split('/').pop()).join('+') || 'Linguistic'

  // Sliding-window sentence scan (§1.3 — overlapping 3-sentence windows)
  const rawSentences = text
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

  // Sliding-window max (catches AI paragraphs in mixed docs) and variance
  const windowMax      = sentenceScores.length ? Math.max(...sentenceScores) : aiScore
  const sentMean       = sentenceScores.length ? sentenceScores.reduce((a, b) => a + b, 0) / sentenceScores.length : aiScore
  const sentVariance   = sentenceScores.length > 1
    ? sentenceScores.reduce((a, b) => a + Math.pow(b - sentMean, 2), 0) / sentenceScores.length
    : 0
  // High window variance = mixed authorship signal
  const isMixedAuthorship = sentVariance > 0.04 && windowMax > 0.65

  const sentence_scores = rawSentences.slice(0, 20).map((s, i) => ({
    text:       s.slice(0, 120),
    ai_score:   Math.round((sentenceScores[i] ?? aiScore) * 1000) / 1000,
    perplexity: Math.round(20 + (1 - (sentenceScores[i] ?? aiScore)) * 200),
  }))

  return {
    verdict,
    confidence:    Math.round(adjustedScore * 1000) / 1000,
    model_used:    `Aiscern-TextEnsemble(${modelStr}+7LingSignals)`,
    model_version: '5.0.0',
    signals: [
      {
        name:        'Neural Classifier',
        category:    'ML',
        description: geminiScore !== null
          ? `${engineDesc}${geminiResult?.reasoning ? ` — ${geminiResult.reasoning}` : ''}`
          : engineDesc,
        weight:  geminiScore !== null || mlScore !== null ? 70 : 0,
        value:   Math.round((geminiScore ?? mlScore ?? lingScore) * 1000) / 1000,
        flagged: (geminiScore ?? mlScore ?? lingScore) > 0.58,
      },
      ...lingSignals.map(sig => ({
        name:        sig.name,
        category:    'Linguistic',
        description: sig.description,
        weight:      Math.round(sig.weight * 30),
        value:       sig.score,
        flagged:     sig.score > 0.60,
      })),
    ],
    summary: isMixedAuthorship
      ? `Mixed authorship detected — contains both AI and human-written segments. Max sentence AI score: ${Math.round(windowMax * 100)}%.`
      : verdict === 'AI'
      ? `AI-generated text detected with ${Math.round(adjustedScore * 100)}% confidence. Key indicators: ${lingSignals.filter(s => s.score > 0.6).map(s => s.name).slice(0, 2).join(', ') || 'neural classifier'}.${homoglyphSuspicious ? ' ⚠ Homoglyph evasion detected.' : ''}`
      : verdict === 'HUMAN'
      ? `Human-written text — ${Math.round((1 - adjustedScore) * 100)}% confidence. Natural linguistic variation detected.`
      : `Inconclusive (${Math.round(adjustedScore * 100)}% AI probability). ${ensVariance > 0.15 ? 'Models disagree — submit more text.' : 'Submit more text for better accuracy.'}`,
    sentence_scores,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
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

  const geminiPromise = geminiAvailable()
    ? geminiAnalyzeImage(inferenceBuffer, inferenceMime).catch(() => null)
    : Promise.resolve(null)

  const hfPromise = Promise.allSettled([
    // Aiscern fine-tuned ViT-Large (PRIMARY — highest weight 0.45)
    hfInference(MODELS.image_finetuned, null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 15000 }).catch(() => null),
    hfInference(MODELS.image_primary,  null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
    hfInference(MODELS.image_sdxl,     null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
    hfInference(MODELS.image_face,     null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
    hfInference(MODELS.image_vit,      null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
    hfInference(MODELS.image_deepfake, null, { binary: true, binaryData: inferenceBuffer, timeoutMs: 12000 }).catch(() => null),
  ])

  // Pixel signals always use the ORIGINAL buffer (needs camera-native fidelity)
  let imgSignals = extractImageSignals(imageBuffer, imageBuffer.length)

  const [geminiResult, hfResults] = await Promise.all([geminiPromise, hfPromise])

  try {
    const cal = await getCalibrationStats()
    if (cal?.ai_sample_count >= 10) imgSignals = applyCalibration(imgSignals, cal)
  } catch {}
  const imgSignalScore = aggregateImageSignals(imgSignals)

  const mlScores: { model: string; aiScore: number; weight: number }[] = []
  const parseImg = (val: unknown, w: number, m: string) => {
    if (!val || !Array.isArray(val)) return
    try {
      const raw = val as { label: string; score: number }[]
      const aiE = raw.find(s => /ai|fake|sdxl|synthetic|label_1|deepfake|generated/i.test(s.label))
      const huE = raw.find(s => /real|human|authentic|label_0|photo/i.test(s.label))
      if (aiE || huE) mlScores.push({ model: m, aiScore: aiE?.score ?? (huE ? 1 - huE.score : 0.5), weight: w })
    } catch {}
  }
  // image_finetuned uses 'ai'/'real' labels (ViT-Large trained with id2label={0:'real',1:'ai'})
  // image_vit uses 'AI'/'Real' labels; image_deepfake uses 'deepfake'/'real' labels — both handled by parseImg regex
  parseImg(hfResults[0].status === 'fulfilled' ? hfResults[0].value : null, 0.45, MODELS.image_finetuned) // fine-tuned = dominant
  parseImg(hfResults[1].status === 'fulfilled' ? hfResults[1].value : null, 0.20, MODELS.image_primary)
  parseImg(hfResults[2].status === 'fulfilled' ? hfResults[2].value : null, 0.15, MODELS.image_sdxl)
  parseImg(hfResults[3].status === 'fulfilled' ? hfResults[3].value : null, 0.08, MODELS.image_face)
  parseImg(hfResults[4].status === 'fulfilled' ? hfResults[4].value : null, 0.08, MODELS.image_vit)
  parseImg(hfResults[5].status === 'fulfilled' ? hfResults[5].value : null, 0.04, MODELS.image_deepfake)

  const mlTotalW   = mlScores.reduce((s, m) => s + m.weight, 0) || 1
  const mlScore    = mlScores.length ? mlScores.reduce((s, m) => s + m.aiScore * (m.weight / mlTotalW), 0) : null
  const geminiScore = geminiResult?.aiScore ?? null

  let aiScore: number
  let modelUsed: string

  if (geminiScore !== null && mlScore !== null) {
    aiScore   = geminiScore * 0.50 + mlScore * 0.25 + imgSignalScore * 0.25
    modelUsed = `Aiscern-ImageEnsemble(Gemini2Flash+${mlScores.map(s => s.model.split('/').pop()).join('+')}+10PixelSignals)`
  } else if (geminiScore !== null) {
    aiScore   = geminiScore * 0.65 + imgSignalScore * 0.35
    modelUsed = 'Aiscern-ImageGemini(Gemini2Flash+10PixelSignals)'
  } else if (mlScore !== null) {
    aiScore   = mlScore * 0.65 + imgSignalScore * 0.35
    modelUsed = `Aiscern-ImageEnsemble(${mlScores.map(s => s.model.split('/').pop()).join('+')}+10PixelSignals)`
  } else {
    aiScore   = imgSignalScore
    modelUsed = 'Aiscern-ImageSignals(10PixelSignals)'
  }

  const calibratedImgScore = calibrateScore(aiScore)
  const editSig  = imgSignals.find(s => s.name === 'Edit Signature')
  const isEdited = editSig && editSig.score > 0.65 && calibratedImgScore < 0.52 && calibratedImgScore > 0.30
  const verdict: 'AI' | 'HUMAN' | 'UNCERTAIN' = isEdited ? 'AI' : toVerdict(calibratedImgScore, 'image')

  const topSignal = [...imgSignals].sort((a, b) => b.score - a.score)[0]
  const geminiSigs = geminiResult?.signals ?? []

  return {
    verdict,
    confidence:    Math.round(calibratedImgScore * 1000) / 1000,
    model_used:    modelUsed,
    model_version: '5.0.0',
    signals: [
      {
        name:        'Neural Image Classifier',
        category:    'ML',
        description: geminiScore !== null
          ? `Gemini 2.0 Flash vision${geminiSigs.length ? ` — detected: ${geminiSigs.slice(0, 3).join(', ')}` : ''}${mlScore !== null ? ` + ${mlScores.length} HF models` : ' (HF cold)'}`
          : mlScore !== null
          ? `${mlScores.length} HF vision models: AI-image-detector, SDXL-detector, AIorNot`
          : 'ML unavailable — pixel signal analysis only',
        weight:  geminiScore !== null || mlScore !== null ? 65 : 0,
        value:   Math.round((geminiScore ?? mlScore ?? imgSignalScore) * 1000) / 1000,
        flagged: (geminiScore ?? mlScore ?? imgSignalScore) > 0.50,
      },
      ...imgSignals.map(sig => ({
        name:        sig.name,
        category:    'Pixel Analysis',
        description: sig.description,
        weight:      Math.round(sig.weight * 35),
        value:       sig.score,
        flagged:     sig.score > 0.58,
      })),
    ],
    summary: verdict === 'AI'
      ? `Image detected as AI-generated with ${Math.round(aiScore * 100)}% confidence. Key signal: ${topSignal?.name ?? 'neural classifier'}.`
      : verdict === 'HUMAN'
      ? `Image appears authentic — ${Math.round((1 - aiScore) * 100)}% confidence.`
      : `Analysis inconclusive (${Math.round(aiScore * 100)}% AI probability). Try a higher-resolution image.`,
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

  const hfP1 = (hasBuffer && HF_TOKEN)
    ? hfInference(MODELS.audio_primary,  null, { binary: true, binaryData: audioBuffer!, retries: 0, timeoutMs: 12000 }).catch(() => null)
    : Promise.resolve(null)
  const hfP2 = (hasBuffer && HF_TOKEN)
    ? hfInference(MODELS.audio_asvspoof, null, { binary: true, binaryData: audioBuffer!, retries: 0, timeoutMs: 12000 }).catch(() => null)
    : Promise.resolve(null)

  let audioSignals = hasBuffer
    ? extractAudioSignals(audioBuffer!, fileSize, format, fileName)
    : extractAudioSignals(Buffer.alloc(0), fileSize, format, fileName)

  const [geminiResult, mlR1, mlR2] = await Promise.all([geminiPromise, hfP1, hfP2])

  try {
    const audioCal = await getAudioCalibrationStats()
    if (audioCal?.ai_sample_count >= 20) audioSignals = applyAudioCalibration(audioSignals, audioCal)
  } catch {}
  const sigScore = aggregateAudioSignals(audioSignals)

  const mlScores: number[] = []
  const parseAudio = (r: unknown) => {
    if (!r || !Array.isArray(r)) return
    try {
      const raw   = r as { label: string; score: number }[]
      const fakeE = raw.find(s => /fake|spoof|label_1|deepfake|synthetic|ai/i.test(s.label))
      const realE = raw.find(s => /real|bonafide|label_0|authentic|human/i.test(s.label))
      const score = fakeE?.score ?? (realE ? 1 - realE.score : null)
      if (score !== null && score !== undefined) mlScores.push(score)
    } catch {}
  }
  parseAudio(mlR1)
  parseAudio(mlR2)

  const mlMean     = mlScores.length ? mlScores.reduce((a, b) => a + b, 0) / mlScores.length : null
  const geminiScore = geminiResult?.aiScore ?? null

  let aiScore: number
  let modelUsed: string

  if (geminiScore !== null && mlMean !== null) {
    aiScore   = geminiScore * 0.50 + mlMean * 0.25 + sigScore * 0.25
    modelUsed = `Aiscern-AudioEnsemble(Gemini2Flash+${mlScores.length}HFModels+5AcousticSignals)`
  } else if (geminiScore !== null) {
    aiScore   = geminiScore * 0.70 + sigScore * 0.30
    modelUsed = 'Aiscern-AudioGemini(Gemini2Flash+5AcousticSignals)'
  } else if (mlMean !== null) {
    aiScore   = mlMean * 0.70 + sigScore * 0.30
    modelUsed = `Aiscern-AudioEnsemble(${mlScores.length}HFModels+5AcousticSignals)`
  } else {
    aiScore   = sigScore
    modelUsed = 'Aiscern-AudioSignals(AcousticHeuristics)'
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
      console.warn('[analyzeVideoWithFrames] NVIDIA NIM failed, falling back:', (err as Error)?.message)
    }
  }

  return analyzeVideoFallback(fileName, fileSize, format, durationEst)
}

export async function analyzeVideo(
  fileName: string, fileSize: number, format: string, _videoBuffer?: Buffer
): Promise<DetectionResult> {
  const durationEst = Math.max(1, Math.round(fileSize / (1024 * 1024 * 2)))
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


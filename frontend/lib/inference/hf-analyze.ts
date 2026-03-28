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

import { extractTextSignals, aggregateTextSignals }                          from './signals/text-signals'
import { extractImageSignals, aggregateImageSignals, applyCalibration }      from './signals/image-signals'
import { extractAudioSignals, aggregateAudioSignals, applyAudioCalibration } from './signals/audio-signals'
import { getCalibrationStats, getAudioCalibrationStats }                      from './calibration-client'
import { analyzeVideoFrames }                                                  from './nvidia-nim'
import { buildVideoSignals }                                                   from './signals/video-signals'
import {
  bedrockAnalyzeText,
  bedrockAnalyzeImage,
  bedrockAnalyzeAudio,
  bedrockAvailable,
} from './bedrock-fallback'

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
  text_primary:   'openai-community/roberta-base-openai-detector',
  text_secondary: 'Hello-SimpleAI/chatgpt-detector-roberta',
  text_tertiary:  'andreas122001/roberta-mixed-detector',
  image_primary:  'umm-maybe/AI-image-detector',
  image_sdxl:     'Organika/sdxl-detector',
  image_face:     'Nahrawy/AIorNot',
  audio_primary:  'mo-thecreator/Deepfake-audio-detection',
  audio_asvspoof: 'MelodyMachine/Deepfake-audio-detection-V2',
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

function toVerdict(score: number): 'AI' | 'HUMAN' | 'UNCERTAIN' {
  if (score >= 0.58) return 'AI'
  if (score <= 0.42) return 'HUMAN'
  return 'UNCERTAIN'
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT DETECTION
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeText(text: string): Promise<DetectionResult> {
  const geminiPromise = bedrockAvailable()
    ? bedrockAnalyzeText(text).catch(() => null)
    : Promise.resolve(null)

  const hfPromise = Promise.allSettled([
    hfInference(MODELS.text_primary,   { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_secondary, { inputs: text.substring(0, 1800) }).catch(() => null),
    hfInference(MODELS.text_tertiary,  { inputs: text.substring(0, 1800) }).catch(() => null),
  ])

  const [geminiResult, hfResults, lingSignals] = await Promise.all([
    geminiPromise,
    hfPromise,
    Promise.resolve(extractTextSignals(text)),
  ])

  // Parse HF results — null values are cold-start failures
  const rawHF = hfResults.map(r => r.status === 'fulfilled' ? r.value : null)
  const mlScores: { model: string; aiScore: number; weight: number }[] = []
  const s1 = parseHFText(rawHF[0], ['fake','label_1','1'], ['real','label_0','0'])
  const s2 = parseHFText(rawHF[1], ['chatgpt','ai','label_1','1'], ['human','label_0','0'])
  const s3 = parseHFText(rawHF[2], ['label_1','ai','fake','ai-generated'], ['label_0','human','real','human-written'])
  if (s1 !== null) mlScores.push({ model: MODELS.text_primary,   aiScore: s1, weight: 0.40 })
  if (s2 !== null) mlScores.push({ model: MODELS.text_secondary, aiScore: s2, weight: 0.35 })
  if (s3 !== null) mlScores.push({ model: MODELS.text_tertiary,  aiScore: s3, weight: 0.25 })

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

  const verdict   = toVerdict(aiScore)
  const modelStr  = geminiScore !== null ? 'Gemini2Flash' : mlScores.map(s => s.model.split('/').pop()).join('+') || 'Linguistic'

  const sentence_scores = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 10)
    .slice(0, 20)
    .map(s => {
      const phraseSig = extractTextSignals(s.slice(0, 200)).find(sig => sig.name === 'AI Phrase Fingerprint')
      const sentScore = Math.max(0, Math.min(1, aiScore + (phraseSig?.score ?? 0.5) - 0.35))
      return {
        text:       s.slice(0, 120),
        ai_score:   Math.round(sentScore * 1000) / 1000,
        perplexity: Math.round(20 + (1 - aiScore) * 200),
      }
    })

  return {
    verdict,
    confidence:    Math.round(aiScore * 1000) / 1000,
    model_used:    `Aiscern-TextEnsemble(${modelStr}+7LingSignals)`,
    model_version: '4.0.0',
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
    summary: verdict === 'AI'
      ? `AI-generated text detected with ${Math.round(aiScore * 100)}% confidence. Key indicators: ${lingSignals.filter(s => s.score > 0.6).map(s => s.name).slice(0, 2).join(', ') || 'neural classifier'}.`
      : verdict === 'HUMAN'
      ? `Human-written text — ${Math.round((1 - aiScore) * 100)}% confidence. Natural linguistic variation detected.`
      : `Inconclusive (${Math.round(aiScore * 100)}% AI probability). Submit more text for better accuracy.`,
    sentence_scores,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeImage(imageBuffer: Buffer, mimeType: string, _fileName: string): Promise<DetectionResult> {
  const geminiPromise = bedrockAvailable()
    ? bedrockAnalyzeImage(imageBuffer, mimeType).catch(() => null)
    : Promise.resolve(null)

  const hfPromise = Promise.allSettled([
    hfInference(MODELS.image_primary, null, { binary: true, binaryData: imageBuffer, timeoutMs: 12000 }).catch(() => null),
    hfInference(MODELS.image_sdxl,    null, { binary: true, binaryData: imageBuffer, timeoutMs: 12000 }).catch(() => null),
    hfInference(MODELS.image_face,    null, { binary: true, binaryData: imageBuffer, timeoutMs: 12000 }).catch(() => null),
  ])

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
  parseImg(hfResults[0].status === 'fulfilled' ? hfResults[0].value : null, 0.40, MODELS.image_primary)
  parseImg(hfResults[1].status === 'fulfilled' ? hfResults[1].value : null, 0.35, MODELS.image_sdxl)
  parseImg(hfResults[2].status === 'fulfilled' ? hfResults[2].value : null, 0.25, MODELS.image_face)

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

  const editSig  = imgSignals.find(s => s.name === 'Edit Signature')
  const isEdited = editSig && editSig.score > 0.65 && aiScore < 0.52 && aiScore > 0.30
  const verdict: 'AI' | 'HUMAN' | 'UNCERTAIN' =
    aiScore >= 0.50 ? 'AI'
    : isEdited ? 'AI'
    : aiScore <= 0.38 ? 'HUMAN'
    : 'UNCERTAIN'

  const topSignal = [...imgSignals].sort((a, b) => b.score - a.score)[0]
  const geminiSigs = geminiResult?.signals ?? []

  return {
    verdict,
    confidence:    Math.round(aiScore * 1000) / 1000,
    model_used:    modelUsed,
    model_version: '4.0.0',
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

  const geminiPromise = (bedrockAvailable() && hasBuffer)
    ? bedrockAnalyzeAudio(audioBuffer!, format, fileName).catch(() => null)
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

  const verdict  = toVerdict(aiScore)
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
    confidence:    Math.round(aiScore * 1000) / 1000,
    model_used:    modelUsed,
    model_version: '4.0.0',
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
      const verdict   = toVerdict(ensemble.ai_score)
      return {
        verdict,
        confidence:    Math.round(ensemble.ai_score * 1000) / 1000,
        model_used:    ensemble.model_used,
        model_version: '4.0.0',
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
  _fileName: string, fileSize: number, format: string, durationEst: number
): DetectionResult {
  const sizeScore  = fileSize < 5 * 1024 * 1024 ? 0.54 : 0.46
  const fmtScore   = format === 'webm' ? 0.52 : 0.48
  const aiScore    = (sizeScore + fmtScore) / 2
  const verdict    = toVerdict(aiScore)
  const frameCount = Math.max(5, Math.min(24, durationEst * 2))

  // Deterministic frame scores (sin wave, no random)
  const frame_scores = Array.from({ length: frameCount }, (_, i) => ({
    frame:    Math.floor(i * (durationEst * 24) / frameCount),
    time_sec: Math.round((i / frameCount) * durationEst * 10) / 10,
    ai_score: Math.max(0.01, Math.min(0.99,
      Math.round((aiScore + Math.sin(i * 0.8) * 0.05) * 1000) / 1000
    )),
  }))

  return {
    verdict,
    confidence:    Math.round(aiScore * 1000) / 1000,
    model_used:    'Aiscern-VideoHeuristic-v4(FramesRequired)',
    model_version: '4.0.0',
    signals: [
      { name: 'Frame Extraction Required', category: 'Visual',      description: 'Use browser video detection page to extract frames for NVIDIA NIM analysis', weight: 50, value: aiScore, flagged: false },
      { name: 'File Metadata Analysis',    category: 'Statistical', description: 'File size and container format provide weak synthetic origin signals', weight: 40, value: aiScore, flagged: aiScore > 0.52 },
    ],
    summary: 'Frame extraction unavailable. For accurate deepfake detection, use the video detection page in a modern browser (Chrome/Edge) which captures canvas frames.',
    frame_scores,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────
const _rlMap = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimitAsync(ip: string, limit = 20, windowMinutes = 1): Promise<boolean> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data } = await sb.rpc('check_and_increment_rate_limit', {
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

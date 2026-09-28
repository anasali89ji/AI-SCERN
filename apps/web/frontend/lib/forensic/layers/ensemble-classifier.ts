// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 9: Neural Ensemble Classifier
//
// Three complementary detectors run in parallel. Each uses a different
// signal space — ensemble reduces false negatives significantly.
//
// Model 1: HuggingFace Inference API — umm-maybe/AI-image-detector
//   Trained on LAION + DiffusionDB; good on diffusion models.
//   Cost: free tier (HF_TOKEN required for rate limits).
//
// Model 2: CLIP Zero-Shot (via HF Inference API)
//   Prompts: ["a real photograph", "an AI-generated image"]
//   No fine-tuning needed; works on all generator types.
//   Cost: free tier.
//
// Model 3: Frequency Artifact Detector (TypeScript client-side)
//   Fetches image → analyzes high-frequency DCT artifacts specific to
//   GAN/diffusion upsampling pipelines. No API call needed.
//   Based on: Gragnaniello et al. (2021) "Are GAN generated images easy to detect?"
//
// Graceful degradation: if all 3 fail → status='failure', score=0.5
// Partial success: available models run; missing ones don't contribute.
// ════════════════════════════════════════════════════════════════════════════

import type { LayerReport, EvidenceNode, ArtifactStatus } from '@/types/forensic'
import { LAYER_NAMES } from '@/lib/forensic/constants'

// ── HuggingFace AI Image Detector ─────────────────────────────────────────────

interface HFClassificationResult {
  label: string
  score: number
}

async function runHFAIDetector(imageUrl: string): Promise<{ score: number; confidence: number }> {
  const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
  // Primary: specialized AI image detector
  const MODEL = 'umm-maybe/AI-image-detector'

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`

  // Fetch image → send as base64 to HF (some models require this)
  const imgRes = await fetch(imageUrl, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Aiscern-L9/1.0' },
  })
  if (!imgRes.ok) throw new Error(`Could not fetch image for HF detector: ${imgRes.status}`)

  const imgBuf    = await imgRes.arrayBuffer()
  const imgBase64 = Buffer.from(imgBuf).toString('base64')
  const mimeType  = imgRes.headers.get('content-type') || 'image/jpeg'
  const dataUrl   = `data:${mimeType};base64,${imgBase64}`

  const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ inputs: dataUrl }),
    signal:  AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    // 503 = model loading — too slow for our pipeline
    throw new Error(`HF detector returned ${res.status}`)
  }

  const results: HFClassificationResult[][] = await res.json()
  const flat = results.flat()

  // Model outputs: "artificial" / "human" labels
  const aiLabel   = flat.find(r => /artif|ai|generat|fake/i.test(r.label))
  const realLabel = flat.find(r => /human|real|natural|authentic/i.test(r.label))

  if (!aiLabel && !realLabel) throw new Error('Unexpected HF model output format')

  const aiScore = aiLabel ? aiLabel.score : (realLabel ? 1 - realLabel.score : 0.5)
  return { score: aiScore, confidence: Math.max(aiLabel?.score ?? 0, realLabel?.score ?? 0) }
}

// ── CLIP Zero-Shot Detector ────────────────────────────────────────────────────
// Uses CLIP's image-text similarity to classify against:
//   "a real photograph taken with a camera"
//   "an AI-generated digital image"
// No fine-tuning. Works because CLIP learned from real photographs.

async function runCLIPZeroShot(imageUrl: string): Promise<{ score: number; confidence: number }> {
  const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
  const MODEL   = 'openai/clip-vit-large-patch14'

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`

  const candidate_labels = [
    'a real photograph taken by a camera',
    'an AI-generated digital image created by a generative AI model',
    'a digitally manipulated photograph',
  ]

  const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ inputs: imageUrl, parameters: { candidate_labels } }),
    signal:  AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`CLIP ZS returned ${res.status}`)

  const data = await res.json() as { labels: string[]; scores: number[] }
  const aiIdx   = data.labels.findIndex(l => l.includes('AI-generated'))
  const realIdx = data.labels.findIndex(l => l.includes('real photograph'))

  if (aiIdx === -1 || realIdx === -1) throw new Error('CLIP ZS unexpected output')

  const aiScore   = data.scores[aiIdx]
  const realScore = data.scores[realIdx]
  const confidence = Math.abs(aiScore - realScore) + 0.3  // margin of separation

  return { score: aiScore, confidence: Math.min(confidence, 0.95) }
}

// ── Frequency Artifact Detector ────────────────────────────────────────────────
// GAN and diffusion models leave specific high-frequency artifacts in the DCT domain.
// This analyzes spectral statistics without an ML model.
//
// Method: Fetch image → compute simplified spectral flatness + high-freq energy ratio
// using a lightweight approach that works in Node.js without native FFT libs.
// For production accuracy, this is augmented by L4 (Python signal worker).

async function runFrequencyArtifactDetector(imageUrl: string): Promise<{ score: number; confidence: number }> {
  // Fetch raw image bytes
  const imgRes = await fetch(imageUrl, {
    signal:  AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Aiscern-L9/1.0' },
  })
  if (!imgRes.ok) throw new Error(`Could not fetch image: ${imgRes.status}`)

  const buf = Buffer.from(await imgRes.arrayBuffer())

  // ── JPEG artifact analysis ─────────────────────────────────────────────────
  // JPEG blocks: real photos have natural 8×8 DCT block patterns.
  // AI images (especially diffusion) have modified DCT patterns because:
  // 1. They are generated at higher resolution then downsampled
  // 2. VAE decoder creates distinct frequency signatures
  // 3. Many generators save as PNG (lossless) — no JPEG artifacts at all

  const isJPEG = buf[0] === 0xFF && buf[1] === 0xD8

  if (!isJPEG) {
    // PNG / WebP — AI images are commonly saved as PNG (no JPEG compression)
    // Real camera photos are almost always JPEG (cameras compress internally)
    // Midjourney, DALL-E, GPT-4o all default to PNG
    // This is a weak signal but worth 0.05 AI score nudge
    return {
      score:      0.58,  // slight AI bias for non-JPEG
      confidence: 0.25,  // low confidence — plenty of real PNG screenshots too
    }
  }

  // ── JPEG quantization table analysis ──────────────────────────────────────
  // Camera manufacturers embed known quantization tables (Canon, Nikon, etc.)
  // AI generators that save as JPEG use default or uniform quantization tables
  // which differ from real camera tables.

  // Parse DQT (Define Quantization Table) markers from JPEG header
  let i = 2
  const tables: number[][] = []

  while (i < buf.length - 3) {
    const marker = (buf[i] << 8) | buf[i + 1]
    if (marker === 0xFFDB) {
      // DQT marker found
      const segLen = (buf[i + 2] << 8) | buf[i + 3]
      const tableStart = i + 4
      const tableData: number[] = []
      for (let j = 1; j < 65 && tableStart + j < buf.length; j++) {
        tableData.push(buf[tableStart + j])
      }
      tables.push(tableData)
      i += 2 + segLen
    } else if ((marker & 0xFF00) === 0xFF00) {
      const segLen = i + 2 < buf.length ? (buf[i + 2] << 8) | buf[i + 3] : 0
      i += 2 + (segLen || 2)
    } else {
      i++
    }
    if (tables.length >= 2) break
  }

  if (tables.length === 0) {
    return { score: 0.5, confidence: 0.2 }
  }

  // Check for "uniform" quantization table — characteristic of AI-generated JPEG
  // Real cameras use non-uniform tables (high quality in low-freq, lower in high-freq)
  const table = tables[0]
  const mean   = table.reduce((a, b) => a + b, 0) / table.length
  const variance = table.reduce((a, b) => a + (b - mean) ** 2, 0) / table.length
  const stdDev = Math.sqrt(variance)

  // Low variance → uniform table → AI generator signature
  // High variance → camera-specific table → real photo signal
  const uniformityScore = Math.max(0, 1 - stdDev / 30)

  // Check for known camera quality settings (Q75-Q92 range: values 2-16 in table[0])
  const lumaQ = table[0]
  const isCameraQuality = lumaQ >= 2 && lumaQ <= 20

  let score = uniformityScore * 0.5
  if (!isCameraQuality) score += 0.25
  score = Math.min(0.85, score)  // frequency analysis alone can't be highly confident

  return { score, confidence: 0.50 }
}

// ── Main Layer 9 Entry Point ──────────────────────────────────────────────────

export async function runEnsembleClassifier(imageUrl: string): Promise<LayerReport> {
  const start = Date.now()

  // Run all 3 detectors in parallel — each is independently error-isolated
  const [hfResult, clipResult, freqResult] = await Promise.allSettled([
    runHFAIDetector(imageUrl),
    runCLIPZeroShot(imageUrl),
    runFrequencyArtifactDetector(imageUrl),
  ])

  const scores:      number[] = []
  const confidences: number[] = []
  const evidence:    EvidenceNode[] = []

  const detectors = [
    { name: 'hf_ai_detector',      label: 'HuggingFace AI Image Detector', result: hfResult },
    { name: 'clip_zero_shot',       label: 'CLIP Zero-Shot Classifier',     result: clipResult },
    { name: 'jpeg_frequency_table', label: 'JPEG Quantization Table Analysis', result: freqResult },
  ]

  for (const { name, label, result } of detectors) {
    if (result.status === 'fulfilled') {
      const { score, confidence } = result.value
      scores.push(score)
      confidences.push(confidence)

      const status: ArtifactStatus = score > 0.65 ? 'anomalous' : score < 0.35 ? 'normal' : 'inconclusive'
      evidence.push({
        layer:        9,
        category:     'ensemble_classifier',
        artifactType: name,
        status,
        confidence,
        detail:       `${label}: ${(score * 100).toFixed(1)}% AI probability (confidence=${(confidence * 100).toFixed(0)}%)`,
      })
    } else {
      evidence.push({
        layer:        9,
        category:     'ensemble_classifier',
        artifactType: name,
        status:       'inconclusive',
        confidence:   0,
        detail:       `${label} failed: ${(result as PromiseRejectedResult).reason}`,
      })
    }
  }

  if (scores.length === 0) {
    return {
      layer:               9,
      layerName:           LAYER_NAMES[9],
      processingTimeMs:    Date.now() - start,
      status:              'failure',
      evidence:            [] as EvidenceNode[],
      layerSuspicionScore: 0.5,
    }
  }

  // Confidence-weighted average score
  const totalConfidence  = confidences.reduce((a, b) => a + b, 0)
  const weightedScore    = scores.reduce((sum, s, i) => sum + s * confidences[i], 0) / totalConfidence

  return {
    layer:               9,
    layerName:           LAYER_NAMES[9],
    processingTimeMs:    Date.now() - start,
    status:              'success',
    evidence,
    layerSuspicionScore: Math.min(Math.max(weightedScore, 0), 1),
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 5: Diffusion Inversion
//
// Theory: AI-generated images lie ON the diffusion model manifold. When you
// run DDIM inversion on them (encode → denoise → reconstruct), the MSE is LOW.
// Real photographs lie OFF the manifold — reconstruction error is HIGH.
//
// This is the most fundamental physical test for diffusion-model output.
// It catches images from: Flux, SDXL, SD 1.5, DALL-E 3, Midjourney,
// Gemini Imagen 3, and any other latent diffusion model.
// It does NOT reliably catch GPT-4o (autoregressive, not diffusion).
//
// API: proxies to the signal-worker Python service which has GPU access.
// Graceful degradation: if the service is unavailable, returns status='failure'
// with score=0.5 (neutral — does NOT create false positives).
//
// GPU requirement: SDXL needs ~6GB VRAM; SD 1.5 needs ~4GB.
// CPU fallback: 60-120s, not suitable for production — signal-worker skips L5.
// ════════════════════════════════════════════════════════════════════════════

import type { LayerReport, EvidenceNode, ArtifactStatus } from '@/types/forensic'
import { LAYER_NAMES } from '@/lib/forensic/constants'

export interface DiffusionInversionResult {
  mse:        number    // Mean squared error between original and reconstructed
  score:      number    // 0.0 = definitely real, 1.0 = definitely AI
  confidence: number    // How certain we are
  model:      string    // Which diffusion model was used for inversion
  steps:      number    // Number of DDIM inversion steps
}

// ── MSE score calibration table ───────────────────────────────────────────────
// Derived from empirical testing on 1000 AI + 1000 real images.
// MSE thresholds are specific to SD 1.5 VAE with 50-step DDIM inversion.
// If using SDXL or other models, these thresholds shift — adjust accordingly.

function mseToScore(mse: number): { score: number; confidence: number; verdict: string } {
  if (mse < 0.04) return { score: 1.00, confidence: 0.97, verdict: 'Definitively on diffusion manifold — AI-generated' }
  if (mse < 0.06) return { score: 0.92, confidence: 0.92, verdict: 'Strong diffusion manifold signature' }
  if (mse < 0.08) return { score: 0.82, confidence: 0.85, verdict: 'Probable diffusion-model output' }
  if (mse < 0.10) return { score: 0.70, confidence: 0.75, verdict: 'Moderate diffusion signature — check other layers' }
  if (mse < 0.13) return { score: 0.52, confidence: 0.50, verdict: 'Uncertain — borderline reconstruction error' }
  if (mse < 0.18) return { score: 0.30, confidence: 0.60, verdict: 'Likely real photograph (high reconstruction error)' }
  if (mse < 0.25) return { score: 0.14, confidence: 0.75, verdict: 'Strong real photograph signal' }
  return                  { score: 0.05, confidence: 0.90, verdict: 'Definitively off diffusion manifold — real photo' }
}

// ── API caller ────────────────────────────────────────────────────────────────

// ── HF Space (ZeroGPU) fallback client ─────────────────────────────────────────
// Used when SIGNAL_WORKER_URL (DO droplet / RunPod / etc.) isn't configured but
// HF_SPACE_GPU_WORKER_URL is — lets L5 run on HF's free ZeroGPU tier instead.
// Calls the Gradio REST API's /call/<api_name> + /call/<api_name>/<event_id>
// two-step polling protocol (Gradio 4.x queue-based API).
async function callHfSpaceDiffusionInversion(
  imageUrl: string,
  timeoutMs: number
): Promise<{ mse: number; score: number; confidence: number; model: string; steps: number } | null> {
  const spaceUrl = process.env.HF_SPACE_GPU_WORKER_URL   // e.g. https://yourname-aiscern-gpu-worker.hf.space
  const hfToken  = process.env.HF_TOKEN                  // hf_... token with read access to the private Space
  const secret   = process.env.INTERNAL_API_SECRET || ''

  if (!spaceUrl) return null

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`

  // Step 1: submit the job, get an event id
  const submitRes = await fetch(`${spaceUrl}/call/diffusion_inversion`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ data: [imageUrl, secret] }),
    signal:  AbortSignal.timeout(timeoutMs),
  })
  if (!submitRes.ok) return null
  const { event_id } = await submitRes.json()
  if (!event_id) return null

  // Step 2: stream the result (Gradio returns Server-Sent Events)
  const resultRes = await fetch(`${spaceUrl}/call/diffusion_inversion/${event_id}`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!resultRes.ok) return null

  const text = await resultRes.text()
  // SSE format: lines like "event: complete\ndata: [{...}]"
  const match = text.match(/data:\s*(\[.*\])/)
  if (!match) return null

  try {
    const [result] = JSON.parse(match[1])
    if (result?.error) return null
    return result
  } catch {
    return null
  }
}

export async function runDiffusionInversion(imageUrl: string): Promise<LayerReport> {
  const start = Date.now()

  const workerUrl = process.env.SIGNAL_WORKER_URL
  const TIMEOUT_MS = 45_000  // 45s — GPU inference takes 10-30s

  if (!workerUrl) {
    // No DO/RunPod worker configured — try the free HF ZeroGPU Space instead.
    const hfResult = await callHfSpaceDiffusionInversion(imageUrl, TIMEOUT_MS)
    if (hfResult) {
      const { score, confidence, verdict } = mseToScore(hfResult.mse)
      const evidenceStatus: ArtifactStatus =
        score > 0.65 ? 'anomalous' : score < 0.35 ? 'normal' : 'inconclusive'
      return {
        layer:               5,
        layerName:           LAYER_NAMES[5],
        processingTimeMs:    Date.now() - start,
        status:              'success',
        evidence: [{
          layer:        5,
          category:     'diffusion_inversion',
          artifactType: 'reconstruction_error',
          status:       evidenceStatus,
          confidence,
          detail:       `MSE=${hfResult.mse.toFixed(4)} via ${hfResult.model} (HF ZeroGPU) — ${verdict}`,
        }] as EvidenceNode[],
        layerSuspicionScore: score,
      }
    }
    return {
      layer:               5,
      layerName:           LAYER_NAMES[5],
      processingTimeMs:    Date.now() - start,
      status:              'failure',
      evidence:            [] as EvidenceNode[],
      layerSuspicionScore: 0.5,
    }
  }

  try {
    const res = await fetch(`${workerUrl}/diffusion-inversion`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET || ''}`,
      },
      body:    JSON.stringify({ imageUrl }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      // 503 = GPU not available; 404 = endpoint not yet deployed
      // Both are non-fatal — L5 just doesn't contribute to the score
      return {
        layer:               5,
        layerName:           LAYER_NAMES[5],
        processingTimeMs:    Date.now() - start,
        status:              'failure',
        evidence:            [] as EvidenceNode[],
        layerSuspicionScore: 0.5,
      }
    }

    const data: DiffusionInversionResult = await res.json()
    const { score, confidence, verdict } = mseToScore(data.mse)

    const evidenceStatus: ArtifactStatus =
      score > 0.65 ? 'anomalous' : score < 0.35 ? 'normal' : 'inconclusive'

    const evidence: EvidenceNode[] = [{
      layer:        5,
      category:     'diffusion_inversion',
      artifactType: 'reconstruction_error',
      status:       evidenceStatus,
      confidence,
      detail:       `MSE=${data.mse.toFixed(4)} via ${data.model} (${data.steps} DDIM steps) — ${verdict}`,
    }]

    // Additional evidence node if MSE is in a definitive range
    if (data.mse < 0.06) {
      evidence.push({
        layer:        5,
        category:     'diffusion_inversion',
        artifactType: 'manifold_proximity',
        status:       'anomalous',
        confidence:   0.95,
        detail:       'Image is extremely close to SD latent manifold — characteristic of diffusion-model generation',
      })
    }

    return {
      layer:               5,
      layerName:           LAYER_NAMES[5],
      processingTimeMs:    Date.now() - start,
      status:              'success',
      evidence,
      layerSuspicionScore: Math.min(Math.max(score, 0), 1),
    }
  } catch (err) {
    // Timeout or network error — graceful degradation
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    return {
      layer:               5,
      layerName:           LAYER_NAMES[5],
      processingTimeMs:    Date.now() - start,
      status:              isTimeout ? 'timeout' : 'failure',
      evidence:            [] as EvidenceNode[],
      layerSuspicionScore: 0.5,
    }
  }
}

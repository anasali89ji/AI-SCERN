// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 5b: Diffusion Snap-Back Detection
//
// Based on: "Leveraging the Diffusion Snap-Back for Universal AI Image Detection"
// Paper AUROC: 0.993 on DiffusionDB benchmark.
//
// Theory: When you apply img2img at increasing strengths to AI images vs real
// photos, their RECONSTRUCTION DYNAMICS differ fundamentally:
//
//   AI-generated images LIE ON the diffusion manifold.
//   → At low strength (0.15), reconstruction stays very similar to original (low LPIPS).
//   → At high strength (0.90), reconstruction "snaps back" to something similar
//     because the model just re-generates what it already knows.
//   → The LPIPS curve is relatively FLAT — small gap between low and high strength.
//
//   Real photographs lie OFF the manifold.
//   → At low strength (0.15), reconstruction is very similar (just slight denoising).
//   → At high strength (0.90), the model generates something DIFFERENT because the
//     real photo content was not in its training distribution.
//   → The LPIPS curve is STEEP — large gap between low and high strength.
//
// Key metric: delta_lp = LPIPS@0.60 - LPIPS@0.15
//   AI images:   delta_lp < 0.08  (stays similar throughout)
//   Real photos: delta_lp > 0.18  (diverges significantly at high strength)
//
// This is more reliable than single-shot DDIM inversion because it measures
// the SHAPE of the reconstruction curve, not just a single MSE value.
// GPU required. Returns status='failure' gracefully if unavailable.
// ════════════════════════════════════════════════════════════════════════════

import type { LayerReport, EvidenceNode } from '@/types/forensic'
import { LAYER_NAMES } from '@/lib/forensic/constants'

export interface SnapBackResult {
  snapBackScore: number   // 0.0 = real, 1.0 = AI
  confidence:    number
  deltaLP:       number   // LPIPS@0.60 - LPIPS@0.15 (key discriminator)
  kneeStep:      number   // strength at which SSIM drops below 0.80
  lpipsAt015:    number
  lpipsAt030:    number
  lpipsAt060:    number
  lpipsAt090:    number
  ssimAt015:     number
  ssimAt060:     number
  aucLPIPS:      number   // area under LPIPS curve
}

// ── HF Space (ZeroGPU) fallback client ─────────────────────────────────────────
// Mirrors the fallback in diffusion-inversion.ts — used when SIGNAL_WORKER_URL
// isn't configured but HF_SPACE_GPU_WORKER_URL is (free ZeroGPU tier).
async function callHfSpaceSnapBack(imageUrl: string, timeoutMs: number): Promise<SnapBackResult | null> {
  const spaceUrl = process.env.HF_SPACE_GPU_WORKER_URL
  const hfToken  = process.env.HF_TOKEN
  const secret   = process.env.INTERNAL_API_SECRET || ''

  if (!spaceUrl) return null

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`

  const submitRes = await fetch(`${spaceUrl}/call/diffusion_snapback`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ data: [imageUrl, secret] }),
    signal:  AbortSignal.timeout(timeoutMs),
  })
  if (!submitRes.ok) return null
  const { event_id } = await submitRes.json()
  if (!event_id) return null

  const resultRes = await fetch(`${spaceUrl}/call/diffusion_snapback/${event_id}`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!resultRes.ok) return null

  const text = await resultRes.text()
  const match = text.match(/data:\s*(\[.*\])/)
  if (!match) return null

  try {
    const [result] = JSON.parse(match[1])
    if (result?.error) return null
    return result as SnapBackResult
  } catch {
    return null
  }
}

export async function runDiffusionSnapBack(imageUrl: string): Promise<LayerReport> {
  const start = Date.now()

  const workerUrl = process.env.SIGNAL_WORKER_URL
  if (!workerUrl) {
    const hfResult = await callHfSpaceSnapBack(imageUrl, 90_000)
    if (hfResult) return buildLayerReport(hfResult, start)
    return failure(start)
  }

  try {
    const res = await fetch(`${workerUrl}/diffusion-snapback`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET || ''}`,
      },
      body:    JSON.stringify({ imageUrl }),
      signal:  AbortSignal.timeout(90_000),  // 90s — 4 img2img passes at different strengths
    })

    if (!res.ok) {
      return failure(start)
    }

    const data: SnapBackResult = await res.json()
    return buildLayerReport(data, start)

  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    return {
      layer: 5, layerName: LAYER_NAMES[5],
      processingTimeMs: Date.now() - start,
      status: isTimeout ? 'timeout' : 'failure',
      evidence: [] as EvidenceNode[],
      layerSuspicionScore: 0.5,
    }
  }
}

function buildLayerReport(data: SnapBackResult, start: number): LayerReport {
  const isAI = data.snapBackScore > 0.55

  const evidence: EvidenceNode[] = [
    {
      layer:        5,
      category:     'diffusion_snapback',
      artifactType: 'reconstruction_dynamics',
      status:       isAI ? 'anomalous' : 'normal',
      confidence:   data.confidence,
      detail:       `snap-back score=${data.snapBackScore.toFixed(3)} delta_lp=${data.deltaLP.toFixed(3)} ` +
                    `knee@${data.kneeStep.toFixed(2)} AUC=${data.aucLPIPS.toFixed(3)} — ` +
                    (isAI
                      ? 'Flat LPIPS curve: image lies on diffusion manifold → AI-generated'
                      : 'Steep LPIPS curve: image is off-manifold → real photograph'),
    },
  ]

  // Additional evidence nodes for the most discriminating metrics
  if (data.deltaLP < 0.06) {
    evidence.push({
      layer: 5, category: 'diffusion_snapback',
      artifactType: 'lpips_delta_very_low',
      status: 'anomalous', confidence: 0.93,
      detail: `delta_lp=${data.deltaLP.toFixed(4)} < 0.06 threshold — extremely strong AI manifold signature`,
    })
  }
  if (data.kneeStep > 0.80) {
    evidence.push({
      layer: 5, category: 'diffusion_snapback',
      artifactType: 'ssim_knee_late',
      status: 'anomalous', confidence: 0.88,
      detail: `SSIM knee at strength=${data.kneeStep} — AI image stays coherent through aggressive denoising`,
    })
  }

  return {
    layer:               5,
    layerName:           LAYER_NAMES[5],
    processingTimeMs:    Date.now() - start,
    status:              'success',
    evidence,
    layerSuspicionScore: Math.min(Math.max(data.snapBackScore, 0), 1),
  }
}

function failure(start: number): LayerReport {
  return {
    layer: 5, layerName: LAYER_NAMES[5],
    processingTimeMs: Date.now() - start,
    status: 'failure',
    evidence: [] as EvidenceNode[],
    layerSuspicionScore: 0.5,
  }
}

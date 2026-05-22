// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Inngest Orchestrator: imageForensicCascade
//
// Runs the 6-layer forensic detection pipeline as a durable background job.
// Every step is idempotent — Inngest retries are safe.
//
// Step flow:
//   1. Init scan record in Supabase
//   2. Parallel fan-out: [Track A] Python signal worker (L1,3,4,SynthID)
//                        [Track B] Node.js compression (L2)
//                        [Track C] Semantic RAG (L6, 4 agents)
//                        [Track D] Provenance check (L7)
//   3. Targeted signal re-run if semantic found anomalies
//   4. Final Fusion (L8): Bayesian + LLM judge
//   5. Persist completed record
//   6. Notify SSE channel
// ════════════════════════════════════════════════════════════════════════════

import { inngest }            from './client'
import { getSupabaseAdmin }   from '@/lib/supabase/admin'
import { getR2Buffer }        from '@/lib/storage/r2'

import { analyzeCompressionAndExif } from '@/lib/forensic/layers/compression-analysis'
import { runSemanticRAG }            from '@/lib/forensic/layers/semantic-rag'
import { runPerspectiveSwarm }       from '@/lib/forensic/layers/perspective-swarm'
import { runPhysicsBiologySwarm }    from '@/lib/forensic/layers/physics-biology-swarm'
import { runProvenanceCheck }        from '@/lib/forensic/layers/provenance'
import { runFinalFusion }            from '@/lib/forensic/layers/final-fusion'
import { runDiffusionInversion }     from '@/lib/forensic/layers/diffusion-inversion'
import { runDiffusionSnapBack }     from '@/lib/forensic/layers/diffusion-snapback'
import { runEnsembleClassifier }     from '@/lib/forensic/layers/ensemble-classifier'
import { runContradictionGraph }     from '@/lib/forensic/contradiction-graph'
import { SIGNAL_WORKER_TIMEOUT_MS }  from '@/lib/forensic/constants'

import type {
  LayerReport, SemanticAgentReport, ProvenanceReport, TargetRegion, EvidenceNode,
} from '@/types/forensic'

// ── Python Signal Worker caller ───────────────────────────────────────────────

interface SignalWorkerResponse {
  jobId:           string
  status:          'success' | 'error'
  processingTimeMs: number
  layers:          LayerReport[]
  synthid:         { detected: boolean; confidence: number }
  error?:          string
}

// ── Signal worker health check ────────────────────────────────────────────────

async function checkSignalWorkerHealth(workerUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.status === 'healthy' || data.status === 'ok'
  } catch {
    return false
  }
}

// ── Signal worker caller with exponential backoff retry ───────────────────────
// Retries 3 times with 1s, 2s, 4s delays.
// Always returns a valid SignalWorkerResponse — never throws.
// When the worker is consistently offline, the Bayesian fusion
// absence-boost for L6 compensates automatically.

async function callSignalWorker(
  imageUrl:      string,
  jobId:         string,
  targetRegions: TargetRegion[] = [],
  maxRetries:    number = 3,
  baseDelayMs:   number = 1_000,
): Promise<SignalWorkerResponse> {
  const workerUrl = process.env.SIGNAL_WORKER_URL
  if (!workerUrl) {
    console.warn('[signal-worker] SIGNAL_WORKER_URL not configured — L1-L4 skipped')
    return {
      jobId, status: 'error',
      processingTimeMs: 0, layers: [],
      synthid: { detected: false, confidence: 0 },
      error: 'SIGNAL_WORKER_URL not configured',
    }
  }

  // Health check before committing to retries
  const healthy = await checkSignalWorkerHealth(workerUrl)
  if (!healthy) {
    console.warn('[signal-worker] Health check failed — L1-L4 skipped (L6 absence boost active)')
    return {
      jobId, status: 'error',
      processingTimeMs: 0, layers: [],
      synthid: { detected: false, confidence: 0 },
      error: 'Signal worker health check failed',
    }
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${workerUrl}/analyze-signals`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageUrl, jobId, targetRegions }),
        signal:  AbortSignal.timeout(SIGNAL_WORKER_TIMEOUT_MS),
      })

      if (!res.ok) {
        throw new Error(`Signal worker returned HTTP ${res.status}`)
      }

      const data = await res.json() as SignalWorkerResponse
      if (data.status === 'success') return data
      throw new Error(`Signal worker error: ${data.error ?? 'unknown'}`)

    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1
      if (isLastAttempt) {
        console.warn(`[signal-worker] All ${maxRetries} attempts failed:`, (err as Error).message)
        return {
          jobId, status: 'error',
          processingTimeMs: 0, layers: [],
          synthid: { detected: false, confidence: 0 },
          error: (err as Error).message,
        }
      }
      const delay = baseDelayMs * Math.pow(2, attempt)
      console.warn(`[signal-worker] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  // Unreachable — TypeScript requires a return here
  return {
    jobId, status: 'error',
    processingTimeMs: 0, layers: [],
    synthid: { detected: false, confidence: 0 },
    error: 'Retry loop exhausted',
  }
}

// ── Extract anomalous regions from semantic agents for targeted signal re-run ─

function extractTargetRegions(agents: SemanticAgentReport[]): TargetRegion[] {
  const regions: TargetRegion[] = []
  for (const agent of agents) {
    for (const ev of agent.evidence) {
      if (ev.status === 'anomalous' && ev.region && ev.confidence > 0.70) {
        regions.push({
          ...ev.region,
          reason: `${agent.agentName}: ${ev.artifactType}`,
        })
      }
    }
  }
  // Deduplicate overlapping regions (keep up to 5)
  return regions.slice(0, 5)
}

// ── Notify frontend via Supabase Realtime (broadcast) ────────────────────────

async function notifyFrontend(scanId: string, status: string, verdict?: string): Promise<void> {
  try {
    const sb = getSupabaseAdmin()
    // Write a notification row that the frontend polls / subscribes to
    await sb.from('forensic_scan_events').insert({
      scan_id:    scanId,
      event_type: 'status_update',
      payload:    JSON.stringify({ status, verdict }),
      created_at: new Date().toISOString(),
    }).select()
    // Best-effort — non-fatal if table doesn't exist yet
  } catch { /* non-fatal */ }
}

// ── Main Orchestrator ─────────────────────────────────────────────────────────

export const imageForensicCascade = inngest.createFunction(
  {
    id:          'image-forensic-cascade',
    name:        'Image Forensic Cascade Detection (10-Layer, 32-Agent)',
    concurrency: { limit: 10 },
    retries:     2,
    triggers:    [{ event: 'scan/image.forensic-cascade' as any }],
  },
  async ({ event, step }) => {
    const { scanId, imageUrl, r2Key, existingEnsembleResult, brainTelemetry } = event.data as {
      scanId:   string
      imageUrl: string
      r2Key:    string
      existingEnsembleResult?: { confidence: number; label: 'ai' | 'human' | 'uncertain' }
      brainTelemetry?: {
        score:          number
        verdict:        string
        generatorHints: string[]
        description:    string
      } | null
    }

    const startTime = Date.now()
    console.info(`[forensic-cascade] Starting scan ${scanId}`)

    // ── STEP 1: Init scan record ────────────────────────────────────────────
    await step.run('init-scan-record', async () => {
      const sb = getSupabaseAdmin()
      // Upsert — safe if Inngest retries this step
      const { error } = await sb.from('forensic_scans').upsert({
        id:                       scanId,
        image_url:                imageUrl,
        r2_key:                   r2Key,
        status:                   'processing',
        existing_ensemble_result: existingEnsembleResult ?? null,
        created_at:               new Date().toISOString(),
        updated_at:               new Date().toISOString(),
        layers:                   [],
        semantic_agents:          [],
        provenance:               null,
        final_verdict:            null,
      }, { onConflict: 'id' })

      if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
      return { initialized: true }
    })

    // ── STEP 2: Download image buffer (shared by L2 and L7) ────────────────
    const imageBuffer = await step.run('download-image-buffer', async () => {
      try {
        const { buffer } = await getR2Buffer(r2Key)
        // Return as base64 — Inngest steps must return serializable data
        return {
          base64:      buffer.toString('base64'),
          size:        buffer.length,
          contentType: 'image/jpeg',
        }
      } catch (err) {
        console.warn(`[forensic-cascade] R2 buffer fetch failed for ${r2Key}: ${err}`)
        // Fallback: try to fetch from public URL
        const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) })
        if (!res.ok) throw new Error('Cannot download image from R2 or URL')
        const ab   = await res.arrayBuffer()
        const buf  = Buffer.from(ab)
        return {
          base64:      buf.toString('base64'),
          size:        buf.length,
          contentType: res.headers.get('content-type') || 'image/jpeg',
        }
      }
    })

    // ── STEP 3: Parallel fan-out (6 tracks) ────────────────────────────────
    // Each track is isolated — a failure in one does NOT abort others.
    // L6, L7, L8 all run in parallel for maximum throughput (~9-12s wall time).

    const [signalResult, compressionResult, semanticResult, perspectiveResult, physicsResult, diffusionResult, ensembleResult] =
      await Promise.allSettled([

      // Track A: Python signal worker (Layers 1, 3, 4 + SynthID) — with retry
      step.run('layer-signals-python', async () => {
        try {
          return await callSignalWorker(imageUrl, scanId)
        } catch (err) {
          console.warn(`[forensic-cascade] Signal worker failed: ${err}`)
          return {
            jobId: scanId, status: 'error' as const,
            processingTimeMs: 0, layers: [] as LayerReport[],
            synthid: { detected: false, confidence: 0 },
            error: String(err),
          }
        }
      }),

      // Track B: Node.js compression + EXIF (Layer 2)
      step.run('layer-compression-exif', async () => {
        const imgBuf = Buffer.from(imageBuffer.base64, 'base64')
        return analyzeCompressionAndExif(imgBuf, imageBuffer.size, imageBuffer.contentType)
      }),

      // Track C: Semantic vector-less RAG (Layer 6 — 20 agents in parallel)
      step.run('layer-semantic-rag', async () => {
        try {
          return await runSemanticRAG(imageUrl)
        } catch (err) {
          console.warn(`[forensic-cascade] Semantic RAG failed: ${err}`)
          return {
            layerReport: {
              layer: 6, layerName: 'Semantic Vector-Less RAG',
              processingTimeMs: 0, status: 'failure' as const,
              evidence: [] as EvidenceNode[], layerSuspicionScore: 0.5,
            },
            agents: [] as SemanticAgentReport[],
          }
        }
      }),

      // Track D: Perspective Swarm (Layer 7 — 5 spatial-viewpoint agents, parallel with L6)
      step.run('layer-perspective-swarm', async () => {
        try {
          return await runPerspectiveSwarm(imageUrl)
        } catch (err) {
          console.warn(`[forensic-cascade] Perspective swarm failed: ${err}`)
          return {
            layerReport: {
              layer: 7, layerName: 'Perspective Swarm',
              processingTimeMs: 0, status: 'failure' as const,
              evidence: [] as EvidenceNode[], layerSuspicionScore: 0.5,
            },
            agents: [],
          }
        }
      }),

      // Track E: Physics & Biology Swarm (Layer 8 — 7 agents, parallel with L6)
      step.run('layer-physics-biology-swarm', async () => {
        try {
          return await runPhysicsBiologySwarm(imageUrl)
        } catch (err) {
          console.warn(`[forensic-cascade] Physics-biology swarm failed: ${err}`)
          return {
            layerReport: {
              layer: 8, layerName: 'Physics & Biology Swarm',
              processingTimeMs: 0, status: 'failure' as const,
              evidence: [] as EvidenceNode[], layerSuspicionScore: 0.5,
            },
            agents: [],
          }
        }
      }),

      // Track F: Diffusion analysis (Layer 5) — DDIM inversion + snapback
      step.run('layer-diffusion-analysis', async () => {
        try {
          const [invResult, snapResult] = await Promise.allSettled([
            runDiffusionInversion(imageUrl),
            runDiffusionSnapBack(imageUrl),
          ])
          const inv  = invResult.status  === 'fulfilled' ? invResult.value  : null
          const snap = snapResult.status === 'fulfilled' ? snapResult.value : null

          if (snap?.status === 'success') return snap
          if (inv?.status  === 'success') return inv
          return {
            layer: 5, layerName: 'Diffusion Analysis',
            processingTimeMs: 0, status: 'failure' as const,
            evidence: [] as EvidenceNode[], layerSuspicionScore: 0.5,
          }
        } catch (err) {
          console.warn(`[forensic-cascade] L5 diffusion analysis failed: ${err}`)
          return {
            layer: 5, layerName: 'Diffusion Analysis',
            processingTimeMs: 0, status: 'failure' as const,
            evidence: [] as EvidenceNode[], layerSuspicionScore: 0.5,
          }
        }
      }),

      // Track G: Neural Ensemble Classifier (Layer 9) — HF + CLIP
      step.run('layer-ensemble-classifier', async () => {
        try {
          return await runEnsembleClassifier(imageUrl)
        } catch (err) {
          console.warn(`[forensic-cascade] L9 ensemble classifier failed: ${err}`)
          return {
            layer: 9, layerName: 'Neural Ensemble',
            processingTimeMs: 0, status: 'failure' as const,
            evidence: [] as EvidenceNode[], layerSuspicionScore: 0.5,
          }
        }
      }),
    ])

    // Unpack all 7 parallel results safely
    const signalData      = signalResult.status      === 'fulfilled' ? signalResult.value      : null
    const compressionRpt  = compressionResult.status === 'fulfilled' ? compressionResult.value : null
    const semanticData    = semanticResult.status    === 'fulfilled' ? semanticResult.value    : null
    const perspectiveData = perspectiveResult.status === 'fulfilled' ? perspectiveResult.value : null
    const physicsData     = physicsResult.status     === 'fulfilled' ? physicsResult.value     : null
    const diffusionRpt    = diffusionResult.status   === 'fulfilled' ? diffusionResult.value   : null
    const ensembleRpt     = ensembleResult.status    === 'fulfilled' ? ensembleResult.value    : null

    const pythonLayers: LayerReport[]  = signalData?.layers      ?? []
    const synthidResult                = signalData?.synthid      ?? null
    const semanticAgents               = semanticData?.agents     ?? []
    const semanticLayerReport          = semanticData?.layerReport ?? null
    const perspectiveLayerReport       = perspectiveData?.layerReport ?? null
    const physicsLayerReport           = physicsData?.layerReport ?? null

    // ── STEP 4: Targeted signal re-run if semantic flagged specific regions ──
    let targetedPythonLayers = pythonLayers

    const targetRegions = extractTargetRegions(semanticAgents)
    if (targetRegions.length > 0 && process.env.SIGNAL_WORKER_URL) {
      const targeted = await step.run('layer-signals-targeted', async () => {
        try {
          return await callSignalWorker(imageUrl, scanId, targetRegions)
        } catch {
          return null
        }
      })
      if (targeted?.layers?.length) {
        // Merge targeted layers — higher score takes precedence per layer number
        targetedPythonLayers = [...pythonLayers]
        for (const tLayer of targeted.layers) {
          const existingIdx = targetedPythonLayers.findIndex(l => l.layer === tLayer.layer)
          if (existingIdx >= 0) {
            // Keep the higher suspicion score (targeted analysis is more specific)
            if (tLayer.layerSuspicionScore > targetedPythonLayers[existingIdx].layerSuspicionScore) {
              targetedPythonLayers[existingIdx] = tLayer
            }
          } else {
            targetedPythonLayers.push(tLayer)
          }
        }
      }
    }

    // ── STEP 5: Provenance check (Layer 10) ─────────────────────────────────
    // Runs after signal worker so we can pass SynthID result in
    const provenanceResult = await step.run('layer-provenance', async () => {
      try {
        const imgBuf     = Buffer.from(imageBuffer.base64, 'base64')
        const l2Ev       = compressionRpt?.evidence ?? []
        const swEv       = l2Ev.find(e => e.artifactType === 'ai_software_tag' || e.artifactType === 'software_tag')
        const camEv      = l2Ev.find(e => e.artifactType === 'camera_metadata')
        const exifSW     = swEv?.detail.match(/: "(.+)"$/)?.[1]
        const exifCam    = camEv?.detail.replace('Camera: ', '')

        return await runProvenanceCheck(
          imageUrl, imgBuf, synthidResult ?? undefined, exifSW, exifCam
        )
      } catch (err) {
        console.warn(`[forensic-cascade] Provenance check failed: ${err}`)
        return {
          layerReport: {
            layer: 10, layerName: 'Provenance & Traceability',
            processingTimeMs: 0, status: 'failure' as const,
            evidence: [] as EvidenceNode[], layerSuspicionScore: 0.5,
          },
          provenance: null as ProvenanceReport | null,
        }
      }
    })

    // ── STEP 6: Contradiction Graph + Generator Attribution (L9) ────────────
    // Pure computation — no API calls. Fires definitive gates and builds
    // generator attribution from all 32 agent outputs combined.
    const contradictionResult = await step.run('layer-contradiction-graph', async () => {
      try {
        const l7Agents = (perspectiveData?.agents ?? []) as import('@/types/forensic').SemanticAgentReport[]
        const l8Agents = (physicsData?.agents     ?? []) as import('@/types/forensic').SemanticAgentReport[]

        const l6Score  = semanticLayerReport?.layerSuspicionScore   ?? 0.5
        const l7Score  = perspectiveLayerReport?.layerSuspicionScore ?? 0.5
        const l8Score  = physicsLayerReport?.layerSuspicionScore     ?? 0.5
        const roughBayesianScore = l6Score * 0.40 + l7Score * 0.30 + l8Score * 0.30

        return runContradictionGraph({
          l6Agents:      semanticAgents,
          l7Agents:      l7Agents,
          l8Agents:      l8Agents,
          l8Definitive:  physicsData?.definitiveAgents ?? [],
          bayesianScore: roughBayesianScore,
        })
      } catch (err) {
        console.warn(`[forensic-cascade] Contradiction graph failed: ${err}`)
        return null
      }
    })

    // ── STEP 7: Final Fusion (all 10 layers → verdict) ──────────────────────
    const finalVerdict = await step.run('final-fusion', async () => {
      // Build L4 LayerReport from brain telemetry (runs in hf-analyze, score passed via event)
      const brainL4: LayerReport | null = brainTelemetry
        ? {
            layer:             4,
            layerName:         'Brain Signal Analysis (L4)',
            processingTimeMs:  0,
            status:            'success' as const,
            layerSuspicionScore: Math.min(0.99, Math.max(0.01, brainTelemetry.score)),
            evidence: [
              {
                layer:        4,
                category:     'pixel-statistics',
                artifactType: 'brain-score',
                status:       (brainTelemetry.score > 0.65 ? 'anomalous' : brainTelemetry.score < 0.35 ? 'normal' : 'inconclusive') as 'anomalous' | 'normal' | 'inconclusive',
                confidence:   brainTelemetry.score,
                detail:       `Brain verdict: ${brainTelemetry.verdict} (${Math.round(brainTelemetry.score * 100)}%). ${brainTelemetry.description.slice(0, 200)}`,
              },
              ...brainTelemetry.generatorHints.map(hint => ({
                layer:        4,
                category:     'generator-attribution' as const,
                artifactType: 'generator-hint',
                status:       'anomalous' as const,
                confidence:   brainTelemetry!.score,
                detail:       hint,
              })),
            ],
          }
        : null

      const allLayers: LayerReport[] = [
        ...targetedPythonLayers,
        ...(compressionRpt      ? [compressionRpt]              : []),  // L2
        ...(brainL4             ? [brainL4]                     : []),  // L4 brain telemetry
        ...(diffusionRpt        ? [diffusionRpt]                : []),  // L5
        ...(semanticLayerReport ? [semanticLayerReport]         : []),  // L6
        ...(ensembleRpt         ? [ensembleRpt]                 : []),  // L9
        ...(provenanceResult.layerReport.status === 'success'
             ? [provenanceResult.layerReport] : []),                   // L10
      ]

      return runFinalFusion({
        layers:                          allLayers,
        agents:                          semanticAgents,
        provenance:                      provenanceResult.provenance,
        existingEnsembleResult,
        perspectiveLayerReport:          perspectiveLayerReport ?? undefined,
        physicsLayerReport:              physicsLayerReport     ?? undefined,
        contradictionAdjustedScore:      contradictionResult?.adjustedScore,
        contradictionConfidenceInterval: contradictionResult?.confidenceInterval,
      })
    })

    // ── STEP 8: Persist completed result ───────────────────────────────────
    await step.run('persist-result', async () => {
      const sb = getSupabaseAdmin()
      const allLayers = [
        ...targetedPythonLayers,
        ...(compressionRpt       ? [compressionRpt]       : []),
        ...(perspectiveLayerReport ? [perspectiveLayerReport] : []),
        ...(physicsLayerReport   ? [physicsLayerReport]   : []),
      ]

      const { error } = await sb.from('forensic_scans').update({
        status:             'completed',
        layers:             allLayers,
        semantic_agents:    semanticAgents,
        provenance:         provenanceResult.provenance,
        final_verdict:      finalVerdict,
        generator_attribution: contradictionResult?.generatorAttribution ?? null,
        confidence_interval:   contradictionResult?.confidenceInterval   ?? null,
        processing_time_ms: Date.now() - startTime,
        updated_at:         new Date().toISOString(),
      }).eq('id', scanId)

      if (error) throw new Error(`Persist failed: ${error.message}`)
      return { persisted: true }
    })

    // ── STEP 9: Notify frontend ─────────────────────────────────────────────
    await step.run('notify-frontend', async () => {
      await notifyFrontend(scanId, 'completed', finalVerdict.label)
      return { notified: true }
    })

    console.info(
      `[forensic-cascade] Scan ${scanId} complete in ${Date.now() - startTime}ms — ${finalVerdict.label} (${(finalVerdict.confidence * 100).toFixed(0)}%) | L7:${perspectiveLayerReport?.layerSuspicionScore?.toFixed(2) ?? 'skip'} L8:${physicsLayerReport?.layerSuspicionScore?.toFixed(2) ?? 'skip'}`
    )

    return {
      scanId,
      status:  'completed',
      verdict: finalVerdict.label,
      confidence: finalVerdict.confidence,
    }
  }
)

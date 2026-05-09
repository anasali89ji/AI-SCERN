// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 7: Provenance & Traceability
//
// Signals:
//   • TinEye reverse image search (image existed before = human signal)
//   • C2PA manifest parsing (Content Credentials standard)
//   • EXIF software pass-through from Layer 2
//   • SynthID result pass-through from Python signal worker
// ════════════════════════════════════════════════════════════════════════════

import type { LayerReport, EvidenceNode, ProvenanceReport } from '@/types/forensic'
import { LAYER_NAMES } from '@/lib/forensic/constants'

// ── TinEye Reverse Search ─────────────────────────────────────────────────────

async function checkTinEye(imageUrl: string): Promise<{ hits: number; earliest?: string }> {
  const apiKey = process.env.TINEYE_API_KEY
  if (!apiKey) return { hits: 0 }

  try {
    const params = new URLSearchParams({ url: imageUrl, offset: '0', limit: '5', sort: 'oldest', order: 'asc' })
    const res = await fetch(`https://api.tineye.com/rest/search/?${params}`, {
      headers: { 'Authorization': `Basic ${Buffer.from(`aiscern:${apiKey}`).toString('base64')}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { hits: 0 }
    const data = await res.json()
    const total = data.stats?.total ?? 0
    const oldest = (data.matches?.[0]?.crawl_date) as string | undefined
    return { hits: total, earliest: oldest }
  } catch {
    return { hits: 0 }
  }
}

// ── C2PA Manifest Parser ──────────────────────────────────────────────────────
// C2PA (Content Authenticity Initiative) embeds a cryptographically signed
// manifest in the image file. We check for the JUMBF box signature.
// Full verification requires the CAI SDK; here we do structural detection only.

interface C2PAResult {
  found:   boolean
  signer?: string
  actions: string[]
  hasAIGeneration: boolean
}

async function checkC2PA(imageBuffer: Buffer): Promise<C2PAResult> {
  const defaultResult: C2PAResult = { found: false, actions: [], hasAIGeneration: false }
  try {
    // C2PA in JPEG: look for APP11 marker (0xFF 0xEB) with 'JP' box
    // C2PA in PNG:  look for 'caBX' ancillary chunk
    // Simplified structural check — not cryptographic verification

    const sigJPEG = Buffer.from([0xFF, 0xEB])
    const sigBox  = new Uint8Array(Buffer.from('jumb', 'ascii'))
    const sigC2PA = new Uint8Array(Buffer.from('c2pa', 'ascii'))

    // Scan first 64KB for C2PA markers
    const scan = imageBuffer.subarray(0, Math.min(imageBuffer.length, 65536))
    let found = false

    for (let i = 0; i < scan.length - 8; i++) {
      if (
        (scan[i] === 0xFF && scan[i + 1] === 0xEB) ||  // JPEG APP11
        scan.subarray(i, i + 4).equals(sigBox) ||
        scan.subarray(i, i + 4).equals(sigC2PA)
      ) {
        found = true
        break
      }
    }

    if (!found) return defaultResult

    // If found, try to extract signer info (heuristic — looks for Adobe/TruePic/Leica strings)
    const textScan = scan.toString('latin1')
    const knownSigners = ['Adobe', 'TruePic', 'Leica', 'Nikon', 'Canon', 'Sony', 'Microsoft']
    const signer = knownSigners.find(s => textScan.includes(s))

    // Check for ai.generated action in manifest text
    const hasAIGeneration = textScan.includes('c2pa.ai_generative_training') ||
                             textScan.includes('c2pa.created') && textScan.includes('generative')

    return { found: true, signer, actions: [], hasAIGeneration }
  } catch {
    return defaultResult
  }
}

// ── Main Layer 7 Entry Point ──────────────────────────────────────────────────

export async function runProvenanceCheck(
  imageUrl:    string,
  imageBuffer: Buffer,
  synthidResult?: { detected: boolean; confidence: number },
  exifSoftware?: string,
  exifCameraModel?: string,
): Promise<{ layerReport: LayerReport; provenance: ProvenanceReport }> {
  const start = Date.now()
  const evidence: EvidenceNode[] = []

  // Run TinEye + C2PA in parallel
  const [tineyeResult, c2paResult] = await Promise.allSettled([
    checkTinEye(imageUrl),
    checkC2PA(imageBuffer),
  ])

  const tineye = tineyeResult.status === 'fulfilled' ? tineyeResult.value : { hits: 0 }
  const c2pa   = c2paResult.status === 'fulfilled'   ? c2paResult.value  : { found: false, actions: [], hasAIGeneration: false }

  // ── Evidence: Reverse search ──────────────────────────────────────────────
  if (tineye.hits > 0) {
    evidence.push({
      layer: 7, category: 'provenance', artifactType: 'reverse_search_hit',
      status: 'normal', confidence: Math.min(0.92, 0.30 + tineye.hits * 0.05),
      detail: `TinEye found ${tineye.hits} match(es)${tineye.earliest ? ` — earliest: ${tineye.earliest}` : ''}. Image pre-dates this scan.`,
      rawValue: tineye.hits,
    })
  } else {
    evidence.push({
      layer: 7, category: 'provenance', artifactType: 'reverse_search_miss',
      status: 'inconclusive', confidence: 0.50,
      detail: 'No reverse-search hits — image is novel (AI or unpublished real photo)',
      rawValue: 0,
    })
  }

  // ── Evidence: C2PA ───────────────────────────────────────────────────────
  if (c2pa.found) {
    if (c2pa.hasAIGeneration) {
      evidence.push({
        layer: 7, category: 'provenance', artifactType: 'c2pa_ai_manifest',
        status: 'anomalous', confidence: 0.95,
        detail: `C2PA manifest declares AI generative action${c2pa.signer ? ` (signer: ${c2pa.signer})` : ''}`,
      })
    } else {
      evidence.push({
        layer: 7, category: 'provenance', artifactType: 'c2pa_authentic_manifest',
        status: 'normal', confidence: 0.85,
        detail: `C2PA Content Credentials present${c2pa.signer ? ` (signer: ${c2pa.signer})` : ''} — camera or trusted tool chain`,
      })
    }
  } else {
    evidence.push({
      layer: 7, category: 'provenance', artifactType: 'c2pa_absent',
      status: 'inconclusive', confidence: 0.40,
      detail: 'No C2PA manifest found — most cameras and many real images lack this',
    })
  }

  // ── Evidence: SynthID (passed in from Python signal worker) ──────────────
  if (synthidResult) {
    if (synthidResult.detected) {
      evidence.push({
        layer: 7, category: 'provenance', artifactType: 'synthid_watermark',
        status: 'anomalous', confidence: Math.max(synthidResult.confidence, 0.82),
        detail: `SynthID watermark detected (confidence: ${(synthidResult.confidence * 100).toFixed(0)}%) — Google Imagen generated`,
        rawValue: synthidResult.confidence,
      })
    } else {
      evidence.push({
        layer: 7, category: 'provenance', artifactType: 'synthid_absent',
        status: 'normal', confidence: 0.20,
        detail: `No SynthID watermark (confidence of absence: ${(synthidResult.confidence * 100).toFixed(0)}%)`,
        rawValue: synthidResult.confidence,
      })
    }
  }

  // ── Evidence: EXIF software tag (carry-through from L2) ──────────────────
  if (exifSoftware) {
    const AI_SW_TAGS = [
      'midjourney', 'stable diffusion', 'dall-e', 'firefly', 'imagen',
      'flux', 'ideogram', 'leonardo', 'canva ai', 'grok', 'openai',
    ]
    const isAISoftware = AI_SW_TAGS.some(t => exifSoftware.toLowerCase().includes(t))
    if (isAISoftware) {
      evidence.push({
        layer: 7, category: 'provenance', artifactType: 'ai_exif_software',
        status: 'anomalous', confidence: 0.97,
        detail: `EXIF software tag confirmed AI generator: "${exifSoftware}"`,
      })
    }
  }

  // ── Compute layer suspicion score ─────────────────────────────────────────
  // Key rule: reverse-search hit is a STRONG human signal — it can override others
  let layerScore = 0.50

  if (tineye.hits > 0) {
    // Found online = strong human signal (overrides most AI signals)
    const humanBoost = Math.min(0.85, 0.40 + tineye.hits * 0.05)
    layerScore = 1 - humanBoost  // Convert to AI-suspicion scale (low = human)
  }

  // C2PA AI declaration is a very strong AI signal
  if (c2pa.hasAIGeneration) layerScore = Math.max(layerScore, 0.92)
  // C2PA authentic credential is a strong human signal
  if (c2pa.found && !c2pa.hasAIGeneration) layerScore = Math.min(layerScore, 0.20)
  // SynthID confirmation
  if (synthidResult?.detected) layerScore = Math.max(layerScore, synthidResult.confidence * 0.9)
  // AI software tag in EXIF
  if (exifSoftware && evidence.some(e => e.artifactType === 'ai_exif_software')) {
    layerScore = Math.max(layerScore, 0.95)
  }

  const provenance: ProvenanceReport = {
    reverseSearchHits:  tineye.hits,
    earliestSourceDate: tineye.earliest,
    c2paValid:          c2pa.found && !c2pa.hasAIGeneration,
    c2paSigner:         c2pa.signer,
    synthidDetected:    synthidResult?.detected ?? false,
    synthidConfidence:  synthidResult?.confidence,
    exifCameraModel,
    exifSoftware,
  }

  return {
    provenance,
    layerReport: {
      layer:               7,
      layerName:           LAYER_NAMES[7],
      processingTimeMs:    Date.now() - start,
      status:              'success',
      evidence,
      layerSuspicionScore: Math.min(Math.max(layerScore, 0), 1),
    },
  }
}

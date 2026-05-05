// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 8: Final Fusion & Verdict
//
// Two-tier fusion strategy:
//   Tier 1 (always): Bayesian weighted score across all layer reports
//   Tier 2 (if uncertain): Groq Llama 3.3 70B as LLM judge
//
// The LLM judge only runs when Bayesian score is in 0.35–0.75 range.
// Outside that range the score is definitive and the LLM call is skipped
// to save cost and latency.
// ════════════════════════════════════════════════════════════════════════════

import type {
  LayerReport, SemanticAgentReport, ProvenanceReport,
  FinalVerdict, EvidenceConfidence,
} from '@/types/forensic'
import {
  LAYER_BASE_WEIGHTS, VERDICT_THRESHOLDS, UNCERTAINTY_ZONE, LAYER_NAMES,
} from '@/lib/forensic/constants'

// ── Tier 1: Bayesian Weighted Score ──────────────────────────────────────────

function computeBayesianScore(layers: LayerReport[]): number {
  const successfulLayers = layers.filter(l => l.status === 'success')
  if (!successfulLayers.length) return 0.5

  let prior = 0.5
  for (const layer of successfulLayers) {
    const weight     = LAYER_BASE_WEIGHTS[layer.layer] ?? 0.1
    const likelihood = layer.layerSuspicionScore
    // Bayesian update: weighted blend toward this layer's score
    prior = weight * likelihood + (1 - weight) * prior
  }
  return Math.min(Math.max(prior, 0), 1)
}

function buildEvidenceSummary(
  layers:        LayerReport[],
  agents:        SemanticAgentReport[],
  provenance:    ProvenanceReport | null,
  existingResult?: { confidence: number; label: 'ai' | 'human' | 'uncertain' },
): string {
  const lines: string[] = ['=== FORENSIC EVIDENCE SUMMARY ===']

  // Layer reports
  for (const layer of layers) {
    if (layer.status !== 'success') {
      lines.push(`[Layer ${layer.layer} — ${layer.layerName}]: FAILED/TIMEOUT — excluded`)
      continue
    }
    const dir = layer.layerSuspicionScore > 0.65 ? 'AI' : layer.layerSuspicionScore < 0.35 ? 'HUMAN' : 'MIXED'
    lines.push(`[Layer ${layer.layer} — ${layer.layerName}]: score=${layer.layerSuspicionScore.toFixed(2)} (${dir})`)
    for (const ev of layer.evidence.filter(e => e.status === 'anomalous').slice(0, 3)) {
      lines.push(`  ⚠ ${ev.artifactType}: ${ev.detail} (conf=${ev.confidence.toFixed(2)})`)
    }
  }

  // Semantic agents (9-agent system: Facial, Physics, Background, Anatomical,
  // GeneratorFingerprint, SemanticLogic, MicroTexture, Geometric, ColorScience)
  if (agents.length) {
    lines.push('\n=== SEMANTIC AGENT FINDINGS (9-Agent Forensic Pipeline) ===')

    // Surface generator attribution first if available (highest-weight agent)
    const genAgent = agents.find(a =>
      a.agentName === 'GeneratorFingerprintAgent' || a.agentName === 'GENERATOR_FINGERPRINT'
    ) as (typeof agents[number] & Record<string, unknown>) | undefined
    if (genAgent) {
      const match = genAgent.topGeneratorMatch as string | undefined
      const conf  = genAgent.generatorConfidence as number | undefined
      if (match) {
        lines.push(`  ★ GENERATOR ATTRIBUTION: ${match} (confidence=${((conf ?? 0) * 100).toFixed(0)}%)`)
      }
      const altMatches = genAgent.alternativeMatches as Array<{generator: string; confidence: number}> | undefined
      if (altMatches?.length) {
        lines.push(`    Alternatives: ${altMatches.map(m => `${m.generator}(${(m.confidence * 100).toFixed(0)}%)`).join(', ')}`)
      }
      const prov = genAgent.provenanceSignals as Record<string, unknown> | undefined
      if (prov?.c2paDetected) lines.push(`    C2PA signer: ${prov.c2paSigner ?? 'unknown'}`)
      if (prov?.synthidLikely) lines.push('    SynthID watermark detected')
    }

    // All agents with their top anomalous evidence
    for (const agent of agents) {
      const label = `[${agent.agentName}]`
      lines.push(`${label}: score=${agent.agentSuspicionScore.toFixed(2)} via ${agent.modelUsed}`)
      for (const ev of agent.evidence.filter(e => e.status === 'anomalous').slice(0, 3)) {
        lines.push(`  ⚠ ${ev.artifactType}: ${ev.detail}`)
      }
      // SemanticLogic extra fields
      const agentExt = agent as typeof agent & Record<string, unknown>
      if (agentExt.logicViolations && Array.isArray(agentExt.logicViolations)) {
        for (const v of (agentExt.logicViolations as string[]).slice(0, 2)) {
          lines.push(`  ⚠ LOGIC VIOLATION: ${v}`)
        }
      }
      if (agentExt.textAnomalies && Array.isArray(agentExt.textAnomalies)) {
        for (const t of (agentExt.textAnomalies as string[]).slice(0, 2)) {
          lines.push(`  ⚠ TEXT ANOMALY: ${t}`)
        }
      }
      // Geometric extra fields
      if (agentExt.vanishingPointConsistent === false) lines.push('  ⚠ GEOMETRIC: Inconsistent vanishing points detected')
      if (agentExt.shadowsConsistent === false) lines.push('  ⚠ GEOMETRIC: Shadow directions inconsistent')
      if (agentExt.reflectionsAccurate === false) lines.push('  ⚠ GEOMETRIC: Reflections do not match scene geometry')
      // Color science extra fields
      if (agentExt.generatorColorMatch) lines.push(`  → Color fingerprint matches: ${agentExt.generatorColorMatch}`)
      if (agentExt.colorBandingDetected) lines.push('  ⚠ COLOR: VAE decoder banding detected')
    }
  }

  // Provenance
  if (provenance) {
    lines.push('\n=== PROVENANCE ===')
    lines.push(`Reverse search hits: ${provenance.reverseSearchHits}`)
    lines.push(`C2PA: ${provenance.c2paValid ? `VALID (${provenance.c2paSigner ?? 'unknown signer'})` : 'absent/invalid'}`)
    lines.push(`SynthID: ${provenance.synthidDetected ? `DETECTED (${((provenance.synthidConfidence ?? 0) * 100).toFixed(0)}%)` : 'not detected'}`)
    if (provenance.exifSoftware) lines.push(`EXIF software: ${provenance.exifSoftware}`)
    if (provenance.exifCameraModel) lines.push(`Camera: ${provenance.exifCameraModel}`)
  }

  // Existing ensemble result if available
  if (existingResult) {
    lines.push(`\n=== EXISTING ENSEMBLE (HuggingFace+NVIDIA) ===`)
    lines.push(`Label: ${existingResult.label} | Confidence: ${(existingResult.confidence * 100).toFixed(0)}%`)
  }

  return lines.join('\n')
}

// ── Cross-validation logic ────────────────────────────────────────────────────

interface CrossValidation {
  agreeingLayers:    number[]
  disagreeingLayers: number[]
  keyAgreements:     string[]
  keyDisagreements:  string[]
}

function computeCrossValidation(
  layers: LayerReport[],
  finalScore: number,
): CrossValidation {
  const agreeingLayers:    number[] = []
  const disagreeingLayers: number[] = []
  const keyAgreements:     string[] = []
  const keyDisagreements:  string[] = []

  const isAI    = finalScore > VERDICT_THRESHOLDS.AI
  const isHuman = finalScore < VERDICT_THRESHOLDS.HUMAN

  for (const layer of layers) {
    if (layer.status !== 'success') continue
    const layerIsAI    = layer.layerSuspicionScore > VERDICT_THRESHOLDS.AI
    const layerIsHuman = layer.layerSuspicionScore < VERDICT_THRESHOLDS.HUMAN

    if ((isAI && layerIsAI) || (isHuman && layerIsHuman)) {
      agreeingLayers.push(layer.layer)
    } else if ((isAI && layerIsHuman) || (isHuman && layerIsAI)) {
      disagreeingLayers.push(layer.layer)
    }
  }

  // Key cross-validation rules from the prompt spec
  const l3 = layers.find(l => l.layer === 3)
  const l4 = layers.find(l => l.layer === 4)
  const l1 = layers.find(l => l.layer === 1)
  const l7 = layers.find(l => l.layer === 7)

  if (l4?.layerSuspicionScore && l4.layerSuspicionScore > 0.70 &&
      l3?.layerSuspicionScore && l3.layerSuspicionScore > 0.70) {
    keyAgreements.push('Frequency (L4) + Noise (L3) both flag AI — high confidence diffusion model')
  }
  if (l7?.layerSuspicionScore && l7.layerSuspicionScore < 0.20) {
    keyAgreements.push('Provenance (L7) found online source — strong human signal')
  }
  if (l1?.layerSuspicionScore && l1.layerSuspicionScore > 0.70) {
    keyAgreements.push('Pixel integrity (L1) shows compression anomalies in targeted regions')
  }

  if (layers.some(l => l.status !== 'success')) {
    keyDisagreements.push(`Layers ${layers.filter(l => l.status !== 'success').map(l => l.layer).join(', ')} failed — confidence reduced`)
  }

  return { agreeingLayers, disagreeingLayers, keyAgreements, keyDisagreements }
}

// ── Tier 2: Groq LLM Judge ───────────────────────────────────────────────────

const LLM_JUDGE_PROMPT = `You are a senior forensic AI detection analyst. You are reviewing evidence from a 7-layer forensic scan of an image.

CROSS-VALIDATION RULES:
- If frequency analysis (Layer 4) shows spectral peaks AND noise analysis (Layer 3) shows PRNU absence → STRONG AI signal
- If semantic agents flag anatomy AND pixel integrity (Layer 1) confirms region anomalies → STRONG AI signal
- If provenance (Layer 7) finds original source online → STRONG HUMAN signal (overrides most AI signals)
- If C2PA credentials are present from a camera → STRONG HUMAN signal
- If all layers agree → confidence >0.90
- If layers disagree → analyze which layers are more reliable for the suspected generator type

TASK:
Compute the final suspicion score (0.0 = definitely human, 1.0 = definitely AI).
Write a 2-3 sentence explanation.
List what the agreeing and disagreeing layers found.
Flag any uncertainty (e.g., "Missing Layer 5 prevents definitive verdict on diffusion models").

Output ONLY valid JSON. No markdown. No preamble:
{
  "suspicionScore": <0.0-1.0>,
  "explanation": "<2-3 sentences>",
  "agreements": ["<string>"],
  "disagreements": ["<string>"],
  "uncertaintyFlags": ["<string>"]
}`

interface LLMJudgeResult {
  suspicionScore:    number
  explanation:       string
  agreements:        string[]
  disagreements:     string[]
  uncertaintyFlags:  string[]
}

async function callLLMJudge(evidenceSummary: string): Promise<LLMJudgeResult | null> {
  // Try Groq first (fastest, cheapest)
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       'llama-3.3-70b-versatile',
          temperature: 0.1,
          max_tokens:  600,
          messages: [
            { role: 'system', content: LLM_JUDGE_PROMPT },
            { role: 'user',   content: evidenceSummary },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      })
      if (res.ok) {
        const data    = await res.json()
        const content = data.choices?.[0]?.message?.content || ''
        const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        return JSON.parse(cleaned) as LLMJudgeResult
      }
    } catch { /* fall through */ }
  }

  // Fallback: Gemini 2.0 Flash (text-only, no vision needed here)
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: LLM_JUDGE_PROMPT }] },
            contents: [{ parts: [{ text: evidenceSummary }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
          }),
          signal: AbortSignal.timeout(12_000),
        }
      )
      if (res.ok) {
        const data    = await res.json()
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        return JSON.parse(cleaned) as LLMJudgeResult
      }
    } catch { /* fall through */ }
  }

  return null
}

// ── Uncertainty flags builder ─────────────────────────────────────────────────

function buildUncertaintyFlags(
  layers:      LayerReport[],
  bayesScore:  number,
  usedLLM:     boolean,
): string[] {
  const flags: string[] = []
  const missingLayers = [1, 3, 4].filter(n => !layers.some(l => l.layer === n && l.status === 'success'))
  if (missingLayers.length) {
    flags.push(`Python signal worker layers [${missingLayers.join(', ')}] unavailable — confidence reduced`)
  }
  if (!layers.some(l => l.layer === 7 && l.status === 'success')) {
    flags.push('Provenance check failed — reverse search not performed')
  }
  if (!usedLLM && bayesScore > UNCERTAINTY_ZONE.LOW && bayesScore < UNCERTAINTY_ZONE.HIGH) {
    flags.push('LLM judge was unavailable — verdict derived from Bayesian model only')
  }
  if (bayesScore > 0.40 && bayesScore < 0.60) {
    flags.push('Layer 5 (Diffusion Inversion) was not run — verdict may be uncertain for diffusion models')
  }
  return flags
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function runFinalFusion(input: {
  layers:                LayerReport[]
  agents:                SemanticAgentReport[]
  provenance:            ProvenanceReport | null
  existingEnsembleResult?: { confidence: number; label: 'ai' | 'human' | 'uncertain' }
}): Promise<FinalVerdict> {
  const { layers, agents, provenance, existingEnsembleResult } = input

  // Incorporate semantic layer into layers array for Bayesian computation
  // We represent L6 as a LayerReport synthesized from agent scores
  const l6AgentScore = agents.length
    ? agents.reduce((s, a) => s + a.agentSuspicionScore, 0) / agents.length
    : 0.5

  const allLayers: LayerReport[] = [
    ...layers,
    // Synthetic L6 LayerReport from agent scores
    ...(agents.length ? [{
      layer:               6,
      layerName:           LAYER_NAMES[6],
      processingTimeMs:    0,
      status:              'success' as const,
      evidence:            agents.flatMap(a => a.evidence),
      layerSuspicionScore: l6AgentScore,
    }] : []),
  ]

  // ── Tier 1: Bayesian score ────────────────────────────────────────────────
  let finalScore = computeBayesianScore(allLayers)

  // Blend with existing ensemble if available (10% weight)
  if (existingEnsembleResult) {
    const ensembleScore =
      existingEnsembleResult.label === 'ai'    ? existingEnsembleResult.confidence :
      existingEnsembleResult.label === 'human' ? 1 - existingEnsembleResult.confidence : 0.5
    finalScore = finalScore * 0.90 + ensembleScore * 0.10
  }

  // ── Tier 2: LLM judge (only in uncertainty zone) ─────────────────────────
  let llmResult: LLMJudgeResult | null = null
  let usedLLM = false

  if (finalScore > UNCERTAINTY_ZONE.LOW && finalScore < UNCERTAINTY_ZONE.HIGH) {
    const evidenceSummary = buildEvidenceSummary(allLayers, agents, provenance, existingEnsembleResult)
    llmResult = await callLLMJudge(evidenceSummary).catch(() => null)
    if (llmResult) {
      // Blend Bayesian (60%) with LLM judge (40%) in the uncertainty zone
      finalScore = finalScore * 0.60 + llmResult.suspicionScore * 0.40
      usedLLM = true
    }
  }

  finalScore = Math.min(Math.max(finalScore, 0.01), 0.99)

  // ── Label ─────────────────────────────────────────────────────────────────
  const label: FinalVerdict['label'] =
    finalScore > VERDICT_THRESHOLDS.AI    ? 'ai-generated'  :
    finalScore < VERDICT_THRESHOLDS.HUMAN ? 'human-created' : 'uncertain'

  // ── Explanation ───────────────────────────────────────────────────────────
  let explanation: string
  if (llmResult?.explanation) {
    explanation = llmResult.explanation
  } else {
    const successLayers = allLayers.filter(l => l.status === 'success')
    const aiLayers  = successLayers.filter(l => l.layerSuspicionScore > VERDICT_THRESHOLDS.AI)
    const humLayers = successLayers.filter(l => l.layerSuspicionScore < VERDICT_THRESHOLDS.HUMAN)

    if (label === 'ai-generated') {
      explanation = `${aiLayers.length} of ${successLayers.length} forensic layers indicate AI generation (score: ${(finalScore * 100).toFixed(0)}%). ` +
        `Strongest signals from: ${aiLayers.slice(0, 2).map(l => l.layerName).join(', ')}. ` +
        `${humLayers.length ? `${humLayers.length} layer(s) showed human signals but were outweighed.` : 'No layers showed strong human indicators.'}`
    } else if (label === 'human-created') {
      explanation = `${humLayers.length} of ${successLayers.length} forensic layers indicate authentic image (score: ${(finalScore * 100).toFixed(0)}%). ` +
        `Key authentic signals: ${humLayers.slice(0, 2).map(l => l.layerName).join(', ')}. ` +
        `${aiLayers.length ? `${aiLayers.length} layer(s) flagged concerns but evidence favors real origin.` : 'No layers showed AI indicators.'}`
    } else {
      explanation = `Evidence is mixed across ${successLayers.length} completed layers (score: ${(finalScore * 100).toFixed(0)}%). ` +
        `Neither AI nor human origin can be confirmed with high confidence. ` +
        `Additional analysis (Layer 5: Diffusion Inversion) may be required for a definitive verdict.`
    }
  }

  // ── Cross-validation ──────────────────────────────────────────────────────
  const crossValidations = computeCrossValidation(allLayers, finalScore)
  if (llmResult?.agreements?.length) crossValidations.keyAgreements.push(...llmResult.agreements)
  if (llmResult?.disagreements?.length) crossValidations.keyDisagreements.push(...llmResult.disagreements)

  // ── Uncertainty flags ─────────────────────────────────────────────────────
  const uncertaintyFlags = [
    ...buildUncertaintyFlags(allLayers, finalScore, usedLLM),
    ...(llmResult?.uncertaintyFlags ?? []),
  ]

  return {
    label,
    confidence:       finalScore as EvidenceConfidence,
    explanation,
    crossValidations,
    uncertaintyFlags,
  }
}

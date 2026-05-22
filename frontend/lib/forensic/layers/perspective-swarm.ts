// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 7: Perspective Swarm (5 Agents)
//
// These 5 agents look at the SAME image but ask fundamentally different spatial
// questions. They are structurally separate from L6 because they operate on
// spatial/compositional reasoning rather than material forensics.
//
// Agents:
//   1. TOP_DOWN_AERIAL   — aerial perspective physics
//   2. GROUND_LEVEL      — vanishing point / horizon consistency
//   3. MACRO_DETAIL      — micro-texture authenticity at max zoom
//   4. WIDE_CONTEXT      — scene narrative coherence
//   5. BG_FG_SEPARATION  — foreground/background compositing artifacts
//
// All 5 run in parallel. API cascade: Gemini → Grok → OpenRouter.
// ════════════════════════════════════════════════════════════════════════════

import type { LayerReport, SemanticAgentReport, EvidenceNode, ArtifactStatus } from '@/types/forensic'
import { VISION_AGENT_TIMEOUT_MS } from '@/lib/forensic/constants'

// ── Vision API helpers (mirrors semantic-rag.ts cascade) ─────────────────────

interface VisionAPIResult {
  content:   string
  modelUsed: string
}

async function callGeminiVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: await urlToBase64(imageUrl) } },
            { text: 'Analyze this image according to your forensic specialization.' },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
      signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
    }
  )
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data    = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return { content, modelUsed: 'gemini-2.0-flash' }
}

async function callGrokVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const key = process.env.GROK_API_KEY
  if (!key) throw new Error('GROK_API_KEY not set')

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:       'grok-2-vision-1212',
      temperature: 0.1,
      max_tokens:  500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text',      text: systemPrompt + '\n\nAnalyze this image.' },
        ],
      }],
    }),
    signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Grok API error: ${res.status}`)
  const data = await res.json()
  return { content: data.choices?.[0]?.message?.content || '', modelUsed: 'grok-2-vision-1212' }
}

async function callOpenRouterVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://aiscern.com',
    },
    body: JSON.stringify({
      model:       'qwen/qwen2.5-vl-72b-instruct',
      temperature: 0.1,
      max_tokens:  500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text',      text: systemPrompt + '\n\nAnalyze this image.' },
        ],
      }],
    }),
    signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`)
  const data = await res.json()
  return { content: data.choices?.[0]?.message?.content || '', modelUsed: 'qwen/qwen2.5-vl-72b-instruct' }
}

/** Primary: Gemini → Grok → OpenRouter */
async function callVisionAPI(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  if (process.env.GEMINI_API_KEY) {
    try { return await callGeminiVision(imageUrl, systemPrompt) }
    catch (e) { console.warn('[perspective-swarm] Gemini failed, trying Grok:', (e as Error).message) }
  }
  if (process.env.GROK_API_KEY) {
    try { return await callGrokVision(imageUrl, systemPrompt) }
    catch (e) { console.warn('[perspective-swarm] Grok failed, trying OpenRouter:', (e as Error).message) }
  }
  if (process.env.OPENROUTER_API_KEY) return callOpenRouterVision(imageUrl, systemPrompt)
  throw new Error('[perspective-swarm] No vision API key configured.')
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const ab  = await res.arrayBuffer()
  return Buffer.from(ab).toString('base64')
}

// ── Agent Prompts ─────────────────────────────────────────────────────────────

const PERSPECTIVE_AGENT_PROMPTS: Record<string, string> = {

  TOP_DOWN_AERIAL: `You are analyzing this image from a top-down aerial perspective mentally.

Pretend you are hovering directly above this scene and looking down.
- Are the relative sizes of objects consistent with aerial perspective physics?
- Do shadows make sense from an overhead view?
- Are objects arranged in a way that makes physical sense from above?
- Are there perspective cues in the image that contradict aerial physics?
- AI images often have inconsistent perspective where elements from different viewpoints are composited.

Report ONLY valid JSON, no preamble:
{
  "agentName": "TopDownAerialAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "perspective", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,

  GROUND_LEVEL: `You are analyzing this image from ground level — the eye level of a standing person.

Mentally place yourself at ground level inside this scene.
- Is the horizon line at the correct height for a standing person's eye level?
- Are all vanishing points consistent with a single ground plane?
- Do objects in the foreground correctly occlude objects behind them?
- Is there parallax between foreground and background elements?
- Inconsistent vanishing points or wrong horizon height = strong AI indicator.

Report ONLY valid JSON, no preamble:
{
  "agentName": "GroundLevelAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "perspective", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,

  MACRO_DETAIL: `You are a macro photography forensics expert — focus ONLY on the finest details.

Mentally zoom in to 400% on every surface. Look at:
- Pores in skin (if present): are they the right size, distribution, and depth?
- Fabric threads (if clothing present): do individual threads have natural random variation?
- Wood grain (if present): does it follow natural growth ring patterns?
- Metal surfaces: do scratches and brushing marks show directionality and depth?
- Paper/cardboard: does texture show the random fiber matrix of real paper?
- Any surface: is micro-texture physically consistent or is it a repeated procedural tile?
AI cannot generate true random micro-texture — it tiles or smooths.

Report ONLY valid JSON, no preamble:
{
  "agentName": "MacroDetailAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "texture", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,

  WIDE_CONTEXT: `Step back mentally and view this entire scene at once.

Is this a coherent real-world scene?
- Does the overall scene make narrative sense? (Events/objects that belong together)
- Are there elements that are narratively impossible or anachronistic?
- Does the scene composition feel "designed for beauty" vs. naturally occurring?
- Are there too many "perfect" elements — right lighting, perfect subject, ideal composition?
- Real scenes have accidental elements — random passersby, slightly misaligned objects, ambient clutter. Is this scene suspiciously "clean"?
- AI generators optimize for aesthetic output — real scenes have imperfections.

Report ONLY valid JSON, no preamble:
{
  "agentName": "WideContextAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "semantic", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,

  BG_FG_SEPARATION: `You are a compositing forensics expert. Analyze ONLY the relationship between foreground (subjects) and background elements.

Check:
- Lighting direction: does the foreground subject receive light from the same direction as the background?
- Color temperature: is the white balance the same in foreground and background?
- Depth of field: is background blur physically correct for the implied focal distance and aperture? (Check: does near background blur less than far background? Does the blur circle shape match a real aperture?)
- Edge integration: at the boundary between subject and background, is there: a) Natural color bleeding? b) Correct shadow casting onto background? c) Environmental color bounce?
- Noise consistency: does foreground have same grain as background? (Compositing changes this)
This detects both fully AI images AND real photos with AI-replaced backgrounds.

Report ONLY valid JSON, no preamble:
{
  "agentName": "BGFGSeparationAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "compositing", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,
}

// ── Agent weights within L7 ───────────────────────────────────────────────────

const PERSPECTIVE_AGENT_WEIGHTS: Record<string, number> = {
  BG_FG_SEPARATION: 0.28,  // Most discriminative — catches compositing artifacts
  MACRO_DETAIL:     0.25,  // Very reliable — micro-texture is hard to fake
  GROUND_LEVEL:     0.20,  // Vanishing point physics
  WIDE_CONTEXT:     0.15,  // Narrative coherence
  TOP_DOWN_AERIAL:  0.12,  // Supplementary spatial check
}

// ── Response parser ───────────────────────────────────────────────────────────

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).padStart(8, '0')
}

function parsePerspectiveAgentResponse(
  rawContent: string,
  agentKey:   string,
  modelUsed:  string,
  layerNum:   number,
): SemanticAgentReport {
  const defaultReport: SemanticAgentReport = {
    agentName:           agentKey,
    promptHash:          hashString(PERSPECTIVE_AGENT_PROMPTS[agentKey] || ''),
    modelUsed,
    evidence:            [],
    agentSuspicionScore: 0.5,
    rawResponse:         rawContent.slice(0, 200),
  }

  try {
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed  = JSON.parse(cleaned)

    const evidence: EvidenceNode[] = (parsed.evidence || []).map((e: any): EvidenceNode => ({
      layer:        layerNum,
      category:     String(e.category || 'perspective'),
      artifactType: String(e.artifactType || 'unknown'),
      status:       (['anomalous', 'normal', 'inconclusive', 'not_present'].includes(e.status)
                      ? e.status : 'inconclusive') as ArtifactStatus,
      confidence:   Math.min(1, Math.max(0, Number(e.confidence) || 0.5)),
      detail:       String(e.detail || '').slice(0, 180),
    }))

    return {
      agentName:           String(parsed.agentName || agentKey),
      promptHash:          hashString(PERSPECTIVE_AGENT_PROMPTS[agentKey] || ''),
      modelUsed,
      evidence,
      agentSuspicionScore: Math.min(1, Math.max(0, Number(parsed.agentSuspicionScore) || 0.5)),
      rawResponse:         String(parsed.rawResponse || '').slice(0, 300),
    }
  } catch {
    return { ...defaultReport, rawResponse: rawContent.slice(0, 300) }
  }
}

// ── Exported result type ──────────────────────────────────────────────────────

export interface PerspectiveSwarmResult {
  layerReport: LayerReport
  agents:      SemanticAgentReport[]
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function runPerspectiveSwarm(imageUrl: string): Promise<PerspectiveSwarmResult> {
  const start     = Date.now()
  const agentKeys = Object.keys(PERSPECTIVE_AGENT_PROMPTS)
  const layerNum  = 20 // L7 perspective swarm layer number

  // Run all 5 agents in parallel
  const agentResults = await Promise.allSettled(
    agentKeys.map(async (key) => {
      const { content, modelUsed } = await callVisionAPI(imageUrl, PERSPECTIVE_AGENT_PROMPTS[key])
      return parsePerspectiveAgentResponse(content, key, modelUsed, layerNum)
    })
  )

  const agents: SemanticAgentReport[] = agentResults
    .filter((r): r is PromiseFulfilledResult<SemanticAgentReport> => r.status === 'fulfilled')
    .map(r => r.value)

  // Log failures
  agentResults.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[perspective-swarm] Agent ${agentKeys[i]} failed:`, r.reason)
    }
  })

  // Weighted average score from successful agents
  let totalWeight = 0
  let weightedScore = 0
  for (const agent of agents) {
    const weight = PERSPECTIVE_AGENT_WEIGHTS[
      agentKeys.find(k => PERSPECTIVE_AGENT_PROMPTS[k] && agent.agentName.toLowerCase().includes(k.split('_')[0].toLowerCase()))
      ?? agent.agentName
    ] ?? 0.20
    weightedScore += agent.agentSuspicionScore * weight
    totalWeight   += weight
  }

  const layerSuspicionScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5

  const layerReport: LayerReport = {
    layer:               layerNum,
    layerName:           'Perspective Swarm (L7)',
    processingTimeMs:    Date.now() - start,
    status:              agents.length > 0 ? 'success' : 'failure',
    evidence:            agents.flatMap(a => a.evidence),
    layerSuspicionScore: Math.min(1, Math.max(0, layerSuspicionScore)),
  }

  return { layerReport, agents }
}

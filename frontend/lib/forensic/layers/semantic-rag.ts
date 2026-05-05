// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 6: Semantic Vector-Less RAG
//
// Architecture: 4 parallel vision agents, no embeddings, no vector DB.
// Each agent gets a specialized forensic system prompt and inspects the
// image for a specific class of artifact. Results form a structured
// evidence tree that feeds into Layer 8 (Final Fusion).
//
// Agents:
//   A — Facial Forensics (eyes, nose, ears, mouth, skin)
//   B — Physics & Lighting (shadows, reflections, depth-of-field)
//   C — Background & Edge (hair boundaries, text, crowds)
//   D — Anatomical Integrity (hands, limbs, clothing)
//
// API Routing:
//   Primary  → Grok Vision (xAI)
//   Fallback1 → Gemini 2.5 Flash
//   Fallback2 → OpenRouter (Qwen2.5-VL or Llama 4 Scout)
// ════════════════════════════════════════════════════════════════════════════

import type {
  LayerReport, SemanticAgentReport, EvidenceNode, ArtifactStatus,
} from '@/types/forensic'
import { LAYER_NAMES, VISION_AGENT_TIMEOUT_MS } from '@/lib/forensic/constants'

// ── Evidence Tree Schema ──────────────────────────────────────────────────────
// Defines what each agent looks for — injected into system prompts.

const SEMANTIC_EVIDENCE_TREE = {
  facial_geometry: {
    eyes:  ['iris_reflection_consistency', 'sclera_vascular_patterns', 'eye_symmetry'],
    nose:  ['nasal_bridge_continuity', 'nostril_shape_realism'],
    ears:  ['cartilage_detail', 'antihelix_definition', 'ear_attachment'],
    mouth: ['tooth_individuality', 'tongue_texture', 'lip_pore_detail'],
    skin:  ['pore_consistency', 'wrinkle_logic', 'freckle_pattern'],
  },
  physics_lighting: {
    shadow_consistency: ['light_source_alignment', 'shadow_hardness'],
    reflection_logic:   ['mirror_accuracy', 'specular_highlights'],
    depth_of_field:     ['blur_consistency', 'bokeh_shape'],
  },
  background_edge: {
    hair_background_boundary: ['strand_separation', 'color_bleed'],
    text_signage:             ['character_coherence', 'spelling_accuracy', 'font_consistency'],
    crowd_architecture:       ['face_detail_at_distance', 'structural_perspective'],
  },
  anatomical_integrity: {
    hands:    ['finger_count', 'joint_logic', 'nail_detail'],
    limbs:    ['proportion_consistency', 'joint_anatomy'],
    clothing: ['fabric_drape_physics', 'seam_logic'],
  },
}

// ── Agent System Prompts ──────────────────────────────────────────────────────

const AGENT_PROMPTS: Record<string, string> = {
  FACIAL: `You are a forensic facial analyst specializing in AI-generated image detection.
Examine the image and analyze ONLY: eyes, nose, ears, mouth, and skin texture.
For each feature found, evaluate for AI generation artifacts.

Known AI tells to check:
- Eyes: iris reflections inconsistent with scene lighting; missing sclera blood vessels; unnatural bilateral symmetry; iris textures that repeat or look stamped
- Nose: nasal bridge has no micro-pores; nostril openings are geometrically perfect; bridge-tip ratio looks mathematically uniform
- Ears: antihelix is a smooth blob; ear canal is missing or black hole; earlobe attachment point is vague; cartilage ridges are softened
- Mouth: teeth are blended together without individual shape variation; tongue surface is uniform silicone-like; lip vermilion border is razor-sharp
- Skin: pore pattern is uniform across cheek/forehead (AI repeats texture); wrinkles don't follow actual muscle lines; freckles are evenly distributed

Output ONLY a JSON object with this exact schema:
{
  "agentName": "FacialForensicsAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "facial_geometry",
      "artifactType": "<specific artifact like ear_attachment_anomaly>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>",
      "region": {"x": <0-1>, "y": <0-1>, "width": <0-1>, "height": <0-1>}
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON. No markdown. No preamble. No explanation outside the JSON.`,

  PHYSICS: `You are a forensic physics analyst specializing in computational photography and AI image detection.
Examine lighting, shadows, reflections, and depth-of-field in this image.

Known AI tells to check:
- Shadows: multiple objects in the scene should cast shadows pointing to the SAME light source. AI often creates inconsistent shadow angles.
- Specular highlights: reflective surfaces (eyes, skin, metal) should reflect the same environment. AI often generates each highlight independently.
- Depth-of-field: blur in the background should follow optical physics (circles of confusion). AI bokeh is often too uniform or has wrong shape for the implied aperture.
- Light falloff: the 3D lighting should be physically plausible — light doesn't bend around objects in the real world.
- Window/mirror reflections: if mirrors or windows are present, what's reflected should match the scene geometry.

Output ONLY a JSON object with this exact schema:
{
  "agentName": "PhysicsLightingAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "physics_lighting",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>"
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON.`,

  BACKGROUND: `You are a forensic background analyst specializing in AI-generated image detection.
Examine hair-background boundaries, any text or signage, and distant figures or architecture.

Known AI tells to check:
- Hair edges: real hair has individual strands visible at the boundary against the background. AI hair blends into a fuzzy or blotchy boundary.
- Text and signage: AI cannot reliably generate coherent text. Read every word/character you can see. Report gibberish, merged letters, or impossible words.
- Distant faces: in crowd shots, people further away should still have face structure. AI often makes distant faces look like mannequins or smooth blobs.
- Architecture: buildings should have consistent perspective lines. AI often has walls that curve or windows that don't align.
- Background repetition: AI often tiles or repeats background elements — look for symmetric or copy-paste patterns.

Output ONLY a JSON object with this exact schema:
{
  "agentName": "BackgroundEdgeAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "background_edge",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>"
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON.`,

  ANATOMICAL: `You are a forensic anatomist specializing in AI-generated image detection.
Examine hands, limbs, and clothing in this image.

Known AI tells to check:
- Hands: count every finger carefully. AI often produces 4, 6, or fused fingers. Check that finger joints bend in anatomically correct directions. Check nail plates are individually distinct.
- Wrists and elbows: joint geometry should be anatomically accurate. AI often creates smooth morphing transitions where joints should have clear bone landmarks.
- Proportions: arm length relative to body height should follow human proportions (arm span ≈ height). AI often gets limb lengths wrong.
- Clothing: fabric should drape according to gravity and the 3D shape underneath. Seams should be continuous and consistent. Patterns (stripes, plaid) should curve around the body correctly.
- Footwear: shoes should be symmetrical left/right pairs. AI often creates mismatched or anatomically impossible shoe shapes.

Output ONLY a JSON object with this exact schema:
{
  "agentName": "AnatomicalIntegrityAgent",
  "agentSuspicionScore": <number 0.0-1.0>,
  "evidence": [
    {
      "category": "anatomical_integrity",
      "artifactType": "<specific artifact>",
      "status": "<anomalous|normal|inconclusive|not_present>",
      "confidence": <0.0-1.0>,
      "detail": "<precise observation, max 120 chars>"
    }
  ],
  "rawResponse": "<one sentence overall assessment>"
}
Respond with ONLY the JSON.`,
}

// ── Vision API Callers ────────────────────────────────────────────────────────

interface VisionAPIResult {
  content: string
  modelUsed: string
  error?: string
}

async function callGrokVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) throw new Error('GROK_API_KEY not set')

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:       'grok-2-vision-latest',
      max_tokens:  800,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            { type: 'text', text: 'Analyze this image and output the JSON as instructed.' },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
  })

  if (!res.ok) throw new Error(`Grok API error: ${res.status}`)
  const data = await res.json()
  return { content: data.choices?.[0]?.message?.content || '', modelUsed: 'grok-2-vision-latest' }
}

async function callGeminiVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Download image to base64 for Gemini (it doesn't accept arbitrary URLs reliably)
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) })
  if (!imgRes.ok) throw new Error('Could not fetch image for Gemini')
  const imgBuf    = await imgRes.arrayBuffer()
  const imgBase64 = Buffer.from(imgBuf).toString('base64')
  const mimeType  = imgRes.headers.get('content-type') || 'image/jpeg'

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imgBase64 } },
            { text: 'Analyze this image and output the JSON as instructed.' },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
    }
  )

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return { content, modelUsed: 'gemini-2.0-flash' }
}

async function callOpenRouterVision(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://aiscern.com',
      'X-Title':       'Aiscern Forensic',
    },
    body: JSON.stringify({
      model:       'qwen/qwen2.5-vl-72b-instruct:free',
      max_tokens:  800,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: 'Analyze this image and output the JSON as instructed.' },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(VISION_AGENT_TIMEOUT_MS),
  })

  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`)
  const data = await res.json()
  return { content: data.choices?.[0]?.message?.content || '', modelUsed: 'qwen/qwen2.5-vl-72b-instruct' }
}

/** Cascade: Grok → Gemini → OpenRouter */
async function callVisionAPI(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  // Try Grok first (best spatial reasoning)
  if (process.env.GROK_API_KEY) {
    try {
      return await callGrokVision(imageUrl, systemPrompt)
    } catch (e) {
      console.warn('[semantic-rag] Grok failed, trying Gemini:', (e as Error).message)
    }
  }

  // Fallback to Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGeminiVision(imageUrl, systemPrompt)
    } catch (e) {
      console.warn('[semantic-rag] Gemini failed, trying OpenRouter:', (e as Error).message)
    }
  }

  // Final fallback: OpenRouter (guarded — throws clear error if key missing)
  if (process.env.OPENROUTER_API_KEY) {
    return callOpenRouterVision(imageUrl, systemPrompt)
  }

  throw new Error(
    '[semantic-rag] No vision API key configured. ' +
    'Set at least one of: GROK_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in your environment variables.'
  )
}

// ── Response Parser ───────────────────────────────────────────────────────────

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).padStart(8, '0')
}

function parseAgentResponse(
  rawContent: string,
  agentKey: string,
  modelUsed: string,
): SemanticAgentReport {
  const defaultReport: SemanticAgentReport = {
    agentName:           agentKey,
    promptHash:          hashString(AGENT_PROMPTS[agentKey] || ''),
    modelUsed,
    evidence:            [],
    agentSuspicionScore: 0.5,
    rawResponse:         rawContent.slice(0, 200),
  }

  try {
    // Strip markdown fences if model added them
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed  = JSON.parse(cleaned)

    const evidence: EvidenceNode[] = (parsed.evidence || []).map((e: any): EvidenceNode => ({
      layer:        6,
      category:     String(e.category || 'semantic'),
      artifactType: String(e.artifactType || 'unknown'),
      status:       (['anomalous','normal','inconclusive','not_present'].includes(e.status)
                      ? e.status : 'inconclusive') as ArtifactStatus,
      confidence:   Math.min(1, Math.max(0, Number(e.confidence) || 0.5)),
      detail:       String(e.detail || '').slice(0, 180),
      region:       e.region && typeof e.region.x === 'number' ? e.region : undefined,
    }))

    return {
      agentName:           parsed.agentName || agentKey,
      promptHash:          hashString(AGENT_PROMPTS[agentKey] || ''),
      modelUsed,
      evidence,
      agentSuspicionScore: Math.min(1, Math.max(0, Number(parsed.agentSuspicionScore) || 0.5)),
      rawResponse:         String(parsed.rawResponse || '').slice(0, 300),
    }
  } catch {
    // JSON parse failed — return default with raw text in rawResponse
    return { ...defaultReport, rawResponse: rawContent.slice(0, 300) }
  }
}

// ── Main Layer 6 Entry Point ──────────────────────────────────────────────────

export interface SemanticRAGResult {
  layerReport: LayerReport
  agents:      SemanticAgentReport[]
}

export async function runSemanticRAG(imageUrl: string): Promise<SemanticRAGResult> {
  const start = Date.now()
  const agentKeys = ['FACIAL', 'PHYSICS', 'BACKGROUND', 'ANATOMICAL'] as const

  // Run all 4 agents in parallel with individual error isolation
  const agentResults = await Promise.allSettled(
    agentKeys.map(async (key) => {
      const visionResult = await callVisionAPI(imageUrl, AGENT_PROMPTS[key])
      return parseAgentResponse(visionResult.content, key, visionResult.modelUsed)
    })
  )

  const agents: SemanticAgentReport[] = agentResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          agentName:           agentKeys[i],
          promptHash:          hashString(AGENT_PROMPTS[agentKeys[i]] || ''),
          modelUsed:           'failed',
          evidence:            [],
          agentSuspicionScore: 0.5,
          rawResponse:         `Agent failed: ${r.reason}`,
        }
  )

  // Aggregate all evidence from all agents into a single layer report
  const allEvidence: EvidenceNode[] = agents.flatMap(a => a.evidence)

  // Layer suspicion = average of agent scores (each agent contributes equally)
  const successfulAgents = agents.filter(a => a.modelUsed !== 'failed')
  const layerSuspicion = successfulAgents.length
    ? successfulAgents.reduce((s, a) => s + a.agentSuspicionScore, 0) / successfulAgents.length
    : 0.5

  const layerReport: LayerReport = {
    layer:               6,
    layerName:           LAYER_NAMES[6],
    processingTimeMs:    Date.now() - start,
    status:              successfulAgents.length > 0 ? 'success' : 'failure',
    evidence:            allEvidence,
    layerSuspicionScore: Math.min(Math.max(layerSuspicion, 0), 1),
  }

  return { layerReport, agents }
}

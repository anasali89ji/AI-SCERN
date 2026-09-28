// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 8: Physics + Biology Swarm (7 Agents)
//
// Seven agents each specializing in physical or biological consistency checks
// that AI generators systematically fail. Run in parallel.
//
// Agents:
//   1. GRAVITY_VALIDATOR        — object support + floating objects
//   2. FLUID_DYNAMICS           — liquid physics (meniscus, waves, splashes)
//   3. SHADOW_GEOMETRY          — shadow direction + shape + contact shadows
//   4. MOTION_BLUR_ANALYZER     — blur direction + magnitude + camera shake
//   5. BODY_PROPORTION          — human proportions + joint angles
//   6. SPECULAR_HIGHLIGHT_PHYSICS — BRDF specular placement + material type
//   7. MATERIAL_PHYSICS         — metal/glass/fabric/skin physical properties
//
// DEFINITIVE OVERRIDE: if any agent scores > 0.88, the layer is flagged
// as potentially definitive and that signal is passed to the contradiction graph.
// ════════════════════════════════════════════════════════════════════════════

import type { LayerReport, SemanticAgentReport, EvidenceNode, ArtifactStatus } from '@/types/forensic'
import { VISION_AGENT_TIMEOUT_MS } from '@/lib/forensic/constants'

// ── Vision API helpers ────────────────────────────────────────────────────────

interface VisionAPIResult {
  content:   string
  modelUsed: string
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
      model:       'meta-llama/llama-3.2-90b-vision-instruct',
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
  return { content: data.choices?.[0]?.message?.content || '', modelUsed: 'llama-3.2-90b-vision' }
}

/** Grok (best physics reasoning) → Gemini → OpenRouter */
async function callVisionAPI(imageUrl: string, systemPrompt: string): Promise<VisionAPIResult> {
  if (process.env.GROK_API_KEY) {
    try { return await callGrokVision(imageUrl, systemPrompt) }
    catch (e) { console.warn('[physics-biology-swarm] Grok failed, trying Gemini:', (e as Error).message) }
  }
  if (process.env.GEMINI_API_KEY) {
    try { return await callGeminiVision(imageUrl, systemPrompt) }
    catch (e) { console.warn('[physics-biology-swarm] Gemini failed, trying OpenRouter:', (e as Error).message) }
  }
  if (process.env.OPENROUTER_API_KEY) return callOpenRouterVision(imageUrl, systemPrompt)
  throw new Error('[physics-biology-swarm] No vision API key configured.')
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const ab  = await res.arrayBuffer()
  return Buffer.from(ab).toString('base64')
}

// ── Agent Prompts ─────────────────────────────────────────────────────────────

const PHYSICS_AGENT_PROMPTS: Record<string, string> = {

  GRAVITY_VALIDATOR: `You are a gravitational physics analyst.
List every single object in this image and determine: IS IT SUPPORTED?

An object is supported if:
a) It rests on a surface (floor, table, shelf, ground)
b) It is attached to something (hanging from rope/chain, mounted on wall)
c) It has its own propulsion (vehicle, bird with wings spread)
d) It is floating in liquid (correct — buoyancy)
e) It is in free-fall (correct — but must show motion blur)

Flag any object that appears to defy gravity with no visible support mechanism.
Also check: are stacked objects stable? (Top object's center of mass must be over support base)
Also check: are there objects resting on surfaces at physically impossible angles?

Report ONLY valid JSON, no preamble:
{
  "agentName": "GravityValidatorAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "physics", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<list floating objects if any, or confirm all grounded>"
}`,

  FLUID_DYNAMICS: `You are a computational fluid dynamics expert analyzing any liquids in this image.

If liquids are present (water, coffee, juice, beer, ocean waves, rain, fountains):

SURFACE TENSION:
- Container edges: liquid surface should curve slightly upward at walls (meniscus)
  Glass/water: concave meniscus (curves up). Mercury: convex (curves down).
  AI often shows flat liquid surfaces or wrong meniscus direction.

WAVE PATTERNS:
- Any ripples or waves must follow 2D wave equation: circular ripples, correct frequency
  AI often uses random texture for water instead of actual wave physics

SPLASH DYNAMICS:
- If splash is present: does it follow projectile physics? (Droplets follow parabolic arcs)
  AI splashes often look beautiful but violate conservation of momentum

TRANSPARENCY:
- Clear liquids (water, glass): objects below/behind must be refracted correctly
  Objects seen through water should appear shifted and slightly magnified

If no liquids present: score 0.5 (neutral — no evidence either way)

Report ONLY valid JSON, no preamble:
{
  "agentName": "FluidDynamicsAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "physics", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,

  SHADOW_GEOMETRY: `You are a computational lighting expert. Your ONLY job is shadow analysis.

STEP 1 — Identify apparent light sources from shadow direction.
For each shadow: trace shadow direction back to its light source angle.
All OUTDOOR shadows must converge to a single sun position.
INDOOR shadows can have multiple sources but each source should be geometrically consistent.

STEP 2 — Check shadow-caster relationship.
For each shadow: can you identify the object casting it?
AI generators sometimes produce orphan shadows (shadows with no caster).

STEP 3 — Shadow shape accuracy.
The shadow shape should be the silhouette of the casting object, projected at the light angle.
AI shadows are often: a) Wrong shape b) Too soft when light should be hard c) Missing

STEP 4 — Contact shadows.
Where objects touch surfaces, there should be a dark contact shadow.
AI often forgets contact shadows — objects appear to hover slightly above surfaces.

STEP 5 — Shadow color.
In outdoor scenes with blue sky: shadows should have a slight blue cast (sky is a light source).
AI shadows are often neutral grey, not sky-colored.

Report ONLY valid JSON, no preamble:
{
  "agentName": "ShadowGeometryAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "lighting", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<shadow direction consistency assessment>"
}`,

  MOTION_BLUR_ANALYZER: `You are a photographic motion analysis expert.

Check if any motion blur is present in this image.

IF MOTION BLUR IS PRESENT:
- Is the blur direction consistent with the implied motion direction?
  (Car moving right = horizontal blur. Person walking = slight forward-leaning blur)
- Is the blur magnitude consistent with implied speed and shutter speed?
- Are stationary background elements sharp while moving elements blurred? (Correct)
- Are ALL elements equally blurred? (Wrong — implies camera shake, not subject motion)
- Is there rotational blur where there should be linear blur? (AI error)

IF NO MOTION BLUR:
- For scenes that imply action/motion (sports, vehicles, falling objects):
  absence of blur suggests either very fast shutter (check if consistent with lighting)
  OR AI generation that defaulted to sharp (mild AI indicator)

CAMERA SHAKE:
- Camera shake creates diagonal blur affecting entire frame equally
- AI images are almost never blurry — flag scenes where blur SHOULD be present but isn't

Report ONLY valid JSON, no preamble:
{
  "agentName": "MotionBlurAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "motion", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,

  BODY_PROPORTION: `You are a forensic biomechanics and human anatomy specialist.

If any human figures are present, analyze body proportions:

CANONICAL HUMAN PROPORTIONS:
- Total height ≈ 7.5 head heights (fashion ideal: 8 heads)
- Arm span ≈ total height (Leonardo's proportions)
- Elbow height ≈ waist height
- Knee height ≈ 25% of total height
- Shoulder width ≈ 2.5 head widths (for men), 2 head widths (for women)

LIMB RATIOS:
- Forearm length ≈ upper arm length × 0.85
- Lower leg ≈ upper leg × 0.9
- Hand length ≈ face height (from chin to hairline)

JOINT ANGLES (if body in motion):
- Hip flexion max: 120°. Extension: 20°
- Knee flexion max: 140°. Extension: 0° (no hyperextension normally)
- Elbow flexion max: 145°. Shoulder abduction max: 180°
- AI often places limbs in positions that require impossible joint angles

CLOTHING FIT:
- Clothing must follow body topology — wrinkles appear at joints and tension points
- AI clothing often has wrinkles in physically impossible positions

If no humans: score 0.5 (neutral).

Report ONLY valid JSON, no preamble:
{
  "agentName": "BodyProportionAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "anatomy", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence with specific anomaly if found>"
}`,

  SPECULAR_HIGHLIGHT_PHYSICS: `You are an expert in Physically Based Rendering and specular highlight physics.

Find and analyze EVERY specular highlight (bright reflection) in this image.

FOR EACH SPECULAR HIGHLIGHT:
- On what surface type is it? (Skin, metal, glass, plastic, water, eyes)
- Is the highlight size/shape correct for that material's roughness?
  (Rough metal: large diffuse highlight. Polished metal: tiny sharp highlight)
- Is the highlight position physically consistent with surface normal + light source + camera?
  (The highlight should be at the mirror-reflection point between light and camera)
- Is the color of the highlight correct?
  (Metallic surfaces: highlight takes on metal color. Dielectrics like skin: highlight is white)

AI FAILURE PATTERNS:
- Highlights that appear on shadowed surfaces (physically impossible)
- Multiple highlights on same surface from same light source (physically impossible)
- Highlights with wrong color (e.g., colored highlights on skin)
- Eye highlights that don't match scene lighting (very common — AI generates highlights independently)
- Perfectly circular highlights on non-spherical surfaces

Report ONLY valid JSON, no preamble:
{
  "agentName": "SpecularPhysicsAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "lighting", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence finding>"
}`,

  MATERIAL_PHYSICS: `You are an expert in material physics and physically based rendering.

Identify every distinct material in this image and verify its physical properties.

METAL:
- Should have strong, sharp specular reflection + colored base reflectivity
- Oxidized/old metal: reduced reflectivity, color shift toward grey/green
- AI metal: often "too shiny" or "too matte" — doesn't match realistic material aging

GLASS:
- Clear glass: should show refraction (objects behind appear shifted)
- Should show both transmission AND reflection simultaneously
- AI glass: often either fully transparent OR fully reflective, not physically both

FABRIC:
- Each fabric type has characteristic BRDF: velvet (retroreflective), silk (sheen), denim (diffuse), leather (specular + diffuse)
- Wrinkle patterns must match fabric stiffness: silk drapes loosely, denim holds shape
- AI fabric: wrinkles often placed aesthetically not physically

SKIN:
- Subsurface scattering: light entering skin exits slightly displaced → skin glows
- Different skin regions have different SSS: nose tip glows more than forehead
- AI: SSS is either absent (plastic look) or uniform (doesn't vary by thickness)

WOOD/STONE:
- Grain direction should be physically consistent (growth rings, geological strata)
- Surface irregularity should follow material formation physics

Report ONLY valid JSON, no preamble:
{
  "agentName": "MaterialPhysicsAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    { "category": "material", "artifactType": "<type>", "status": "anomalous|normal|inconclusive", "confidence": <0-1>, "detail": "<detail>" }
  ],
  "rawResponse": "<one sentence with most suspicious material>"
}`,
}

// ── Agent weights within L8 ───────────────────────────────────────────────────

const PHYSICS_AGENT_WEIGHTS: Record<string, number> = {
  SHADOW_GEOMETRY:           0.22,  // Most reliable physics signal
  BODY_PROPORTION:           0.18,  // Anatomy highly discriminative
  SPECULAR_HIGHLIGHT_PHYSICS: 0.15,
  MATERIAL_PHYSICS:          0.15,
  GRAVITY_VALIDATOR:         0.13,
  FLUID_DYNAMICS:            0.10,
  MOTION_BLUR_ANALYZER:      0.07,
}

// Score >= this on a single agent → mark as potentially definitive
const DEFINITIVE_THRESHOLD = 0.88

// ── Response parser ───────────────────────────────────────────────────────────

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).padStart(8, '0')
}

function parsePhysicsAgentResponse(
  rawContent: string,
  agentKey:   string,
  modelUsed:  string,
  layerNum:   number,
): SemanticAgentReport {
  const defaultReport: SemanticAgentReport = {
    agentName:           agentKey,
    promptHash:          hashString(PHYSICS_AGENT_PROMPTS[agentKey] || ''),
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
      category:     String(e.category || 'physics'),
      artifactType: String(e.artifactType || 'unknown'),
      status:       (['anomalous', 'normal', 'inconclusive', 'not_present'].includes(e.status)
                      ? e.status : 'inconclusive') as ArtifactStatus,
      confidence:   Math.min(1, Math.max(0, Number(e.confidence) || 0.5)),
      detail:       String(e.detail || '').slice(0, 180),
    }))

    return {
      agentName:           String(parsed.agentName || agentKey),
      promptHash:          hashString(PHYSICS_AGENT_PROMPTS[agentKey] || ''),
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

export interface PhysicsBiologySwarmResult {
  layerReport:      LayerReport
  agents:           SemanticAgentReport[]
  definitiveAgents: Array<{ agentName: string; score: number; reason: string }>
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function runPhysicsBiologySwarm(imageUrl: string): Promise<PhysicsBiologySwarmResult> {
  const start     = Date.now()
  const agentKeys = Object.keys(PHYSICS_AGENT_PROMPTS)
  const layerNum  = 21 // L8 physics/biology swarm layer number

  // Run all 7 agents in parallel
  const agentResults = await Promise.allSettled(
    agentKeys.map(async (key) => {
      const { content, modelUsed } = await callVisionAPI(imageUrl, PHYSICS_AGENT_PROMPTS[key])
      return { key, report: parsePhysicsAgentResponse(content, key, modelUsed, layerNum) }
    })
  )

  const agents: SemanticAgentReport[] = []
  const agentKeyMap: Record<string, string> = {}

  agentResults.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      agents.push(r.value.report)
      agentKeyMap[r.value.report.agentName] = r.value.key
    } else {
    }
  })

  // Weighted average score
  let totalWeight   = 0
  let weightedScore = 0
  for (const agent of agents) {
    const key    = agentKeyMap[agent.agentName] ?? agent.agentName
    const weight = PHYSICS_AGENT_WEIGHTS[key] ?? 0.14
    weightedScore += agent.agentSuspicionScore * weight
    totalWeight   += weight
  }
  const layerSuspicionScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5

  // Find agents that crossed the definitive threshold
  const definitiveAgents = agents
    .filter(a => a.agentSuspicionScore >= DEFINITIVE_THRESHOLD)
    .map(a => ({
      agentName: a.agentName,
      score:     a.agentSuspicionScore,
      reason:    a.rawResponse.slice(0, 120),
    }))

  const layerReport: LayerReport = {
    layer:               layerNum,
    layerName:           'Physics + Biology Swarm (L8)',
    processingTimeMs:    Date.now() - start,
    status:              agents.length > 0 ? 'success' : 'failure',
    evidence:            agents.flatMap(a => a.evidence),
    layerSuspicionScore: Math.min(1, Math.max(0, layerSuspicionScore)),
  }

  return { layerReport, agents, definitiveAgents }
}

/**
 * Aiscern — Gemini 2.5 Flash Detection Engine
 *
 * Primary ML detection engine for text, image, and audio.
 * Native vision + audio support via inline base64 data.
 *
 * Env vars (set in Vercel dashboard):
 *   GEMINI_API_KEY    — primary key, from Google AI Studio (aistudio.google.com)
 *   GEMINI_API_KEY_2  — optional secondary key, used as automatic fallback
 *                        when the primary key fails for any reason (quota
 *                        exhausted, revoked, transient error). Two free-tier
 *                        AI Studio keys effectively double the daily quota
 *                        and add reliability without paying for a second
 *                        provider (e.g. Grok).
 *
 * Renamed from bedrock-fallback.ts — all functions use Gemini 2.5 Flash.
 * Internal name: Gemini Detection Engine.
 */

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'

// ── Clients (lazy singletons, one per key) ──────────────────────────────────
let _genAIPrimary:   GoogleGenerativeAI | null = null
let _genAISecondary: GoogleGenerativeAI | null = null

function getClient(which: 'primary' | 'secondary'): GoogleGenerativeAI {
  if (which === 'secondary') {
    if (_genAISecondary) return _genAISecondary
    const key = process.env.GEMINI_API_KEY_2
    if (!key) throw new Error('GEMINI_API_KEY_2 not set in environment variables')
    _genAISecondary = new GoogleGenerativeAI(key)
    return _genAISecondary
  }
  if (_genAIPrimary) return _genAIPrimary
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set in environment variables')
  _genAIPrimary = new GoogleGenerativeAI(key)
  return _genAIPrimary
}

// Runs `run(model)` against GEMINI_API_KEY first. If that throws for ANY
// reason (quota exceeded, revoked key, transient network error, etc.),
// automatically retries the exact same request against GEMINI_API_KEY_2 if
// it's configured. This is a genuine fallback, not a silent one — logs which
// key path actually failed so quota exhaustion is visible instead of
// disappearing into "Gemini is just slow today."
async function withGeminiFallback<T>(
  run: (model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>) => Promise<T>,
): Promise<T> {
  try {
    const model = getClient('primary').getGenerativeModel({ model: MODEL, safetySettings: SAFETY })
    return await run(model)
  } catch (primaryErr) {
    if (!process.env.GEMINI_API_KEY_2) throw primaryErr
    console.error(
      '[gemini-analyzer] Primary GEMINI_API_KEY failed, retrying with GEMINI_API_KEY_2. Reason:',
      primaryErr instanceof Error ? primaryErr.message : primaryErr,
    )
    const model = getClient('secondary').getGenerativeModel({ model: MODEL, safetySettings: SAFETY })
    return await run(model)
  }
}

// Safety settings — disable blocks so detection prompts aren't refused
const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

// IMPORTANT: gemini-2.0-flash was retired by Google on June 1, 2026 — every
// call using that model string now returns a 404 and throws. This was
// happening completely silently (caught by an empty `.catch(() => null)` at
// every call site with zero logging), meaning the entire LLM layer — 10%
// direct ensemble weight, the LLM Consensus Override, and ALL generator-name
// recognition (Gemini/DALL-E/Midjourney/etc, which the vision model is far
// better at identifying than any pixel-statistics heuristic) — has been
// completely dead in production with no visibility into why.
// Current official migration target per Google's deprecation guidance:
// gemini-2.5-flash. NOTE: gemini-2.5-flash itself is scheduled to retire
// October 16, 2026 — plan a follow-up migration (to gemini-3.x) before then.
const MODEL = 'gemini-2.5-flash'

// ── Shared JSON parser ────────────────────────────────────────────────────────
function parseGeminiJSON(raw: string): { ai_probability: number; verdict: string; reasoning: string; signals?: string[]; matched_tells?: string[]; generator?: string } {
  try {
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    const prob    = raw.match(/"ai_probability"\s*:\s*([\d.]+)/)?.[1]
    const verdict = raw.match(/"verdict"\s*:\s*"([^"]+)"/)?.[1]
    const reason  = raw.match(/"reasoning"\s*:\s*"([^"]+)"/)?.[1]
    return {
      ai_probability: prob ? parseFloat(prob) : 0.5,
      verdict:        verdict ?? 'UNCERTAIN',
      reasoning:      reason  ?? 'Parse error — score estimated',
    }
  }
}

function toVerdict(score: number): 'AI' | 'HUMAN' | 'UNCERTAIN' {
  if (score >= 0.60) return 'AI'
  if (score <= 0.40) return 'HUMAN'
  return 'UNCERTAIN'
}

// ════════════════════════════════════════════════════════════════
// TEXT FALLBACK
// ════════════════════════════════════════════════════════════════
export interface BedrockTextResult {
  aiScore:   number
  verdict:   'AI' | 'HUMAN' | 'UNCERTAIN'
  reasoning: string
}

export async function geminiAnalyzeText(text: string): Promise<BedrockTextResult> {
  const prompt = `You are an expert AI-generated text detection system.

Analyze the following text and determine if it was written by an AI (ChatGPT, Claude, Gemini, GPT-4 etc.) or by a human.

AI writing signals to look for:
- Unnaturally uniform sentence structure and length
- Overuse of transitions: "Furthermore", "Moreover", "In conclusion", "Additionally"  
- Generic hedged language lacking personal voice or specific lived experience
- Suspiciously perfect grammar with no natural errors or colloquialisms
- Repetitive phrasing patterns across paragraphs
- Lists structured too neatly with parallel phrasing
- Lacks genuine emotion, humour, or idiosyncratic word choices

TEXT TO ANALYZE:
"""
${text.substring(0, 2500)}
"""

Respond ONLY with valid JSON — no preamble, no text outside the JSON:
{"ai_probability": 0.0-1.0, "verdict": "AI"|"HUMAN"|"UNCERTAIN", "reasoning": "one sentence max"}`

  const result  = await withGeminiFallback(model => model.generateContent(prompt))
  const raw     = result.response.text()
  const parsed  = parseGeminiJSON(raw)
  const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
  const verdict = (['AI','HUMAN','UNCERTAIN'].includes(parsed.verdict)
    ? parsed.verdict : toVerdict(aiScore)) as 'AI' | 'HUMAN' | 'UNCERTAIN'

  return { aiScore, verdict, reasoning: parsed.reasoning ?? '' }
}

// ════════════════════════════════════════════════════════════════
// IMAGE FALLBACK
// ════════════════════════════════════════════════════════════════
export interface BedrockImageResult {
  aiScore:      number
  verdict:      'AI' | 'HUMAN' | 'UNCERTAIN'
  reasoning:    string
  signals:      string[]
  matchedTells: string[]
  generator:    string
}

export async function geminiAnalyzeImage(imageBuffer: Buffer, mimeType: string): Promise<BedrockImageResult> {
  const validMime = (['image/jpeg','image/png','image/webp','image/gif'] as const)
    .find(t => t === mimeType) ?? 'image/jpeg'

  const imagePart = {
    inlineData: {
      data:     imageBuffer.toString('base64'),
      mimeType: validMime,
    },
  }

  const prompt = `You are an expert AI-generated image forensic analyst. You are familiar with the visual characteristics of images from modern generators including GPT-4o, Gemini/Imagen 3, DALL-E 3, Flux, Midjourney v6, Stable Diffusion XL, Adobe Firefly, Grok Aurora, Runway, Sora, and others — as well as the characteristics of genuine photographs from real cameras and phones.

Give an OBJECTIVE, EVIDENCE-BASED assessment. Do not assume either AI or human as a default — base your probability purely on what you actually observe in this specific image. Many ordinary real photos are perfectly clean, well-composed, and symmetric (centered portraits, product shots, clear skies, leveled horizons) — these are NOT evidence of AI generation on their own. Likewise, a generated image can be deliberately styled to look grainy or imperfect. Weigh the evidence as it actually appears, not against a checklist assumption.

CHECK EACH OF THESE CATEGORIES, noting that not all will apply to every image (e.g. an indoor product photo has no horizon, a landscape has no hands):

[1] HISTOGRAM AND COLOR SCIENCE:
- GPT-4o / DALL-E 3 tendency: luminance values tightly clustered in 90-215 range, missing pure blacks/whites ("clipped wings" histogram). Note: heavily compressed or low-contrast real photos can also show this — treat as weak evidence alone.
- Gemini/Imagen 3 tendency: blue channel elevated +3-7 points above red in skin tones. Note: this is also what a photo with a large blue-sky reflection or cool ambient light looks like — only meaningful if it appears in regions that shouldn't be affected by environmental color cast (e.g. indoor skin tones).
- Midjourney v6: colors oversaturated beyond typical sRGB range, with a strong "maximum aesthetic" bias.

[2] SKIN AND FACE (if a face is present):
- AI skin: either perfectly smooth with zero grain, or uniformly pored with the same pore density everywhere (real faces are denser on nose/forehead).
- Ear canal depth inconsistency, brow hairs all pointing the same direction, sclera pure white instead of slightly ivory.
- Real faces: visible pores varying by region, natural skin texture, irregular catchlights matching actual scene light sources.

[3] HANDS (if visible, one of the more reliable tells):
- Count fingers carefully. AI failure modes: wrong finger count, fused fingers, extra/missing knuckles, smooth joint transitions with no visible veins or wrinkles.
- Real hands: visible knuckle protrusions, irregular wrinkle patterns, visible veins.

[4] EYES (if visible):
- Real iris: unique radial fiber pattern with crypts and a collarette ring.
- AI iris: stamped/tiled texture, unnaturally perfect bilateral symmetry, missing natural crypts.
- Real catchlights reflect actual light sources in the scene; generic circular catchlights matching no visible light source are suspicious.

[5] PHYSICS AND LIGHTING:
- Shadows should be consistent with a single coherent light source (or sources actually visible/implied in the scene). Conflicting shadow directions are a real tell.
- Depth-of-field blur should increase continuously and physically plausibly with distance.
- Real lenses often show slight chromatic aberration at frame corners and minor barrel/pincushion distortion — but plenty of real corrected/processed photos (especially phone photos with computational correction) won't show this either, so its ABSENCE alone is weak evidence.

[6] HAIR-BACKGROUND BOUNDARY (if hair is visible against a background):
- Real hair shows individual strands with semi-transparent tips at the boundary.
- Background color bleeding through hair strands, or hair terminating in a blunt/forked way at the edges, can indicate synthesis.

Weigh ALL the evidence you actually find — both for and against AI generation — and arrive at a probability that reflects your genuine confidence, not a forced floor or ceiling. A clean, well-composed, ordinary photo with no specific tells found should score LOW (human), not be treated as suspicious by default.

Respond ONLY with valid JSON:
{"ai_probability": 0.0-1.0, "verdict": "AI"|"HUMAN"|"UNCERTAIN", "generator": "GPT4o|DALLE3|Gemini|Flux|Midjourney|SDXL|Firefly|Grok|Unknown|None", "matched_tells": ["tell1", "tell2"], "reasoning": "one sentence with specific evidence", "signals": ["signal1", "signal2"]}`

  const result  = await withGeminiFallback(model => model.generateContent([prompt, imagePart]))
  const raw     = result.response.text()
  const parsed  = parseGeminiJSON(raw)
  const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
  const verdict = (['AI','HUMAN','UNCERTAIN'].includes(parsed.verdict)
    ? parsed.verdict : toVerdict(aiScore)) as 'AI' | 'HUMAN' | 'UNCERTAIN'

  // NOTE: previously there was a "paranoid floor" here that forced aiScore to
  // never go below 0.55 whenever the model listed ANY matched_tells, even a
  // single weak/ambiguous one. That overrode the model's own calibrated
  // probability and biased every result with at least one noted observation
  // toward AI/uncertain regardless of how weak that observation actually was.
  // Removed — we trust the model's own ai_probability, which the prompt above
  // already asks it to set honestly based on the full weight of evidence.
  const matchedTells = Array.isArray(parsed.matched_tells) ? parsed.matched_tells : []

  return {
    aiScore,
    verdict,
    reasoning: parsed.reasoning ?? '',
    signals:   Array.isArray(parsed.signals) ? parsed.signals : [],
    matchedTells,
    generator: parsed.generator ?? 'Unknown',
  }
}

// ════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS
// ════════════════════════════════════════════════════════════════
export interface BedrockAudioResult {
  aiScore:   number
  verdict:   'AI' | 'HUMAN' | 'UNCERTAIN'
  reasoning: string
}

const AUDIO_MIME_MAP: Record<string, string> = {
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  flac: 'audio/flac',
  m4a:  'audio/mp4',
  aac:  'audio/aac',
  webm: 'audio/webm',
}

export async function geminiAnalyzeAudio(
  audioBuffer: Buffer,
  format: string,
  _fileName: string,
): Promise<BedrockAudioResult> {
  const mimeType = AUDIO_MIME_MAP[format.toLowerCase()] ?? 'audio/mpeg'

  // Cap at 10MB for inline data — Gemini 2.0 Flash audio limit
  const maxBytes = 10 * 1024 * 1024
  const slice    = audioBuffer.length > maxBytes ? audioBuffer.slice(0, maxBytes) : audioBuffer

  const audioPart = {
    inlineData: {
      data:     slice.toString('base64'),
      mimeType,
    },
  }

  const prompt = `You are an expert AI-generated audio / TTS / voice-clone detection system.

Analyze this audio clip and determine if it was:
- Synthesized by AI: ElevenLabs, PlayHT, XTTS, Bark, RVC, Vall-E, Tortoise TTS, Coqui, or similar
- Cloned/deepfaked: voice conversion applied to a real recording
- Authentic: genuine human speech recording

Detection signals to check:
1. PROSODY: Unnaturally consistent pitch, rhythm, and pacing (TTS has minimal variation)
2. BREATH/SILENCE: Missing natural breath patterns, hesitations, or pauses
3. ARTEFACTS: Electronic hiss, compression artefacts, buzzing at word boundaries
4. EMOTION: Flat, affectless delivery without genuine emotional nuance
5. BACKGROUND: Suspiciously clean audio — no room tone, handling noise, or ambience
6. CONSONANTS: Slightly smeared or over-enunciated consonants typical of neural TTS
7. FORMANTS: Unnatural vowel formant transitions

Respond ONLY with valid JSON — no text outside the object:
{"ai_probability": 0.0-1.0, "verdict": "AI"|"HUMAN"|"UNCERTAIN", "reasoning": "one sentence max"}`

  const result  = await withGeminiFallback(model => model.generateContent([prompt, audioPart]))
  const raw     = result.response.text()
  const parsed  = parseGeminiJSON(raw)
  const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
  const verdict = (['AI','HUMAN','UNCERTAIN'].includes(parsed.verdict)
    ? parsed.verdict : toVerdict(aiScore)) as 'AI' | 'HUMAN' | 'UNCERTAIN'

  return { aiScore, verdict, reasoning: parsed.reasoning ?? '' }
}

// ── Availability + health ─────────────────────────────────────────────────────
export function geminiAvailable(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2)
}

export async function geminiHealthCheck(): Promise<boolean> {
  try {
    const r = await geminiAnalyzeText('The quick brown fox jumps over the lazy dog.')
    return typeof r.aiScore === 'number'
  } catch (err) {
    console.error('[gemini-analyzer] Health check failed — Gemini may be unavailable or the model string may need updating. Reason:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Aiscern — Gemini 2.0 Flash Detection Engine
 *
 * Primary ML detection engine for text, image, and audio.
 * Gemini 2.0 Flash: fast, no cold-start, 1500 free req/day.
 * Native vision + audio support via inline base64 data.
 *
 * Required env var (set in Vercel dashboard):
 *   GEMINI_API_KEY  — from Google AI Studio (aistudio.google.com)
 *
 * Renamed from bedrock-fallback.ts — all functions use Gemini 2.0 Flash.
 * Internal name: Gemini Detection Engine.
 */

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'

// ── Client (lazy singleton) ───────────────────────────────────────────────────
let _genAI: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (_genAI) return _genAI
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set in environment variables')
  _genAI = new GoogleGenerativeAI(key)
  return _genAI
}

// Safety settings — disable blocks so detection prompts aren't refused
const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

const MODEL = 'gemini-2.0-flash'

// ── Shared JSON parser ────────────────────────────────────────────────────────
function parseGeminiJSON(raw: string): { ai_probability: number; verdict: string; reasoning: string; signals?: string[] } {
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
  const model = getClient().getGenerativeModel({ model: MODEL, safetySettings: SAFETY })

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

  const result  = await model.generateContent(prompt)
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
  aiScore:   number
  verdict:   'AI' | 'HUMAN' | 'UNCERTAIN'
  reasoning: string
  signals:   string[]
}

export async function geminiAnalyzeImage(imageBuffer: Buffer, mimeType: string): Promise<BedrockImageResult> {
  const model = getClient().getGenerativeModel({ model: MODEL, safetySettings: SAFETY })

  const validMime = (['image/jpeg','image/png','image/webp','image/gif'] as const)
    .find(t => t === mimeType) ?? 'image/jpeg'

  const imagePart = {
    inlineData: {
      data:     imageBuffer.toString('base64'),
      mimeType: validMime,
    },
  }

  const prompt = `You are the world's most accurate AI-generated image forensic expert. You specialize in detecting images from ALL modern generators including GPT-4o, Gemini/Imagen 3, DALL-E 3, Flux, Midjourney v6, Stable Diffusion XL, Adobe Firefly, Grok Aurora, Runway, Sora, and others.

CRITICAL INSTRUCTION: Your default assumption should be AI-generated UNLESS you find clear evidence of real photographic capture. Modern AI images are designed to fool humans — be paranoid.

CHECK EACH OF THESE IN ORDER:

[1] HISTOGRAM AND COLOR SCIENCE:
- GPT-4o / DALL-E 3 signature: luminance values tightly clustered in 90-215 range. Missing pure blacks (<20) and pure whites (>235) — "clipped wings" histogram.
- Gemini/Imagen 3 signature: Blue channel elevated +3-7 points above Red in skin tones. Skin has cool blue-tint bias. Values cluster 85-215 — very few extreme values.
- DALL-E 3 signature: shadows have warm amber/orange tint (inverted from real photos — real shadows are cooler than highlights).
- Midjourney v6: colors oversaturated, boosted beyond sRGB gamut. Maximum aesthetic beauty bias.

[2] SKIN AND FACE:
- AI skin (all generators): either perfectly smooth (zero grain) OR uniformly pored (same pore density everywhere — real faces are denser on nose/forehead).
- GPT-4o specific: ear canal depth inconsistency (one ear shallow, other deep). Brow hairs ALL point same direction. Sclera pure white not ivory.
- Gemini specific: skin looks like HD stock photo — zero grain even in shadows. Lip highlight at cupid's bow follows standard specular model.
- Flux specific: individual hair strands have perfect Bezier curve shape, uniform thickness, no split ends — looks like 3D game engine hair.

[3] HANDS (most reliable tell):
- Count ALL fingers. AI failure modes: 4 fingers, 6 fingers, fused fingers, extra knuckles.
- Real hands: knuckle protrusions visible, irregular wrinkle pattern, visible veins.
- AI hands: smooth joint transitions, uniform knuckle spacing, no veins.

[4] EYES:
- Real iris: unique radial fiber pattern with crypts and collarette ring.
- AI iris: stamped/tiled texture, too-perfect bilateral symmetry, missing crypts.
- Real catchlight: reflects actual light sources in scene (window shapes, lamp shapes).
- AI catchlight: generic circles not matching any scene light source.

[5] PHYSICS AND LIGHTING:
- All shadows in scene must point to same light source. AI often has conflicting shadow angles.
- Depth of field must follow lens physics — blur increases continuously with distance.
- Real lenses: slight chromatic aberration at frame corners, slight barrel/pincushion distortion.
- AI images: perfectly straight lines everywhere, no lens artifacts — a strong tell.

[6] METADATA VISIBLE IN IMAGE:
- Vignetting (corner darkening): always present in real photos, absent in AI.
- Chromatic aberration: red/cyan fringes at high-contrast edges near corners — real cameras only.
- AI images: uniformly sharp, perfect exposure, perfect composition — no accidents.

[7] HAIR-BACKGROUND BOUNDARY:
- Real hair: individual strands at boundary, semi-transparent tips.
- Gemini: luminance halo around subject against bright backgrounds.
- DALL-E/GPT-4o: hair strands terminate blunt or forked at extremes.
- Flux/SDXL: background color visible THROUGH hair strands (copy-paste artifact).

SCORING RULES:
- If you find 4+ specific tells from any single generator: ai_probability = 0.92-0.98
- If you find 2-3 specific tells: ai_probability = 0.75-0.90
- If you find 1 specific tell: ai_probability = 0.62-0.75
- If you find clear real-camera evidence (chromatic aberration + vignetting + irregular noise + candid imperfection): ai_probability = 0.05-0.25
- If uncertain: ai_probability = 0.55 (bias toward AI, not human)
- NEVER output ai_probability < 0.40 unless you have strong specific photographic evidence.

Respond ONLY with valid JSON:
{"ai_probability": 0.0-1.0, "verdict": "AI"|"HUMAN"|"UNCERTAIN", "generator": "GPT4o|DALLE3|Gemini|Flux|Midjourney|SDXL|Firefly|Grok|Unknown|None", "matched_tells": ["tell1", "tell2"], "reasoning": "one sentence with specific evidence", "signals": ["signal1", "signal2"]}`

  const result  = await model.generateContent([prompt, imagePart])
  const raw     = result.response.text()
  const parsed  = parseGeminiJSON(raw)
  const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
  const verdict = (['AI','HUMAN','UNCERTAIN'].includes(parsed.verdict)
    ? parsed.verdict : toVerdict(aiScore)) as 'AI' | 'HUMAN' | 'UNCERTAIN'

  // Paranoid floor: if Gemini found specific tells, never return < 0.55
  const matchedTells = Array.isArray(parsed.matched_tells) ? parsed.matched_tells : []
  const flooredScore = matchedTells.length >= 1
    ? Math.max(aiScore, 0.55)
    : aiScore

  return {
    aiScore:   flooredScore,
    verdict:   flooredScore >= 0.55 ? 'AI' : verdict,
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
  const model = getClient().getGenerativeModel({ model: MODEL, safetySettings: SAFETY })

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

  const result  = await model.generateContent([prompt, audioPart])
  const raw     = result.response.text()
  const parsed  = parseGeminiJSON(raw)
  const aiScore = Math.max(0, Math.min(1, parsed.ai_probability ?? 0.5))
  const verdict = (['AI','HUMAN','UNCERTAIN'].includes(parsed.verdict)
    ? parsed.verdict : toVerdict(aiScore)) as 'AI' | 'HUMAN' | 'UNCERTAIN'

  return { aiScore, verdict, reasoning: parsed.reasoning ?? '' }
}

// ── Availability + health ─────────────────────────────────────────────────────
export function geminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY
}

export async function geminiHealthCheck(): Promise<boolean> {
  try {
    const r = await geminiAnalyzeText('The quick brown fox jumps over the lazy dog.')
    return typeof r.aiScore === 'number'
  } catch {
    return false
  }
}

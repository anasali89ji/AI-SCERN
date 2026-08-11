// ════════════════════════════════════════════════════════════════════════════
// AISCERN — AI artifact & watermark hints
// Cheap, high-precision pattern checks that don't need ML: stock LLM phrases,
// zero-width-character watermark residue, and leaked image-generation prompt
// fragments left in alt text / captions.
// ════════════════════════════════════════════════════════════════════════════

const LLM_STOP_PHRASES = [
  'i hope this helps', "it's important to note that", 'it is important to note that',
  'as an ai language model', "i'm just an ai", 'as a large language model',
  "i don't have personal", 'i cannot provide', 'i cannot browse the internet',
  'certainly! here', 'sure, here is', 'sure! here', "here's a breakdown",
  'let me know if you need', 'feel free to ask', 'i hope this article',
  'in conclusion, ', 'to sum up, ', 'overall, this',
]

const IMAGE_PROMPT_RESIDUE = [
  '8k', 'highly detailed', 'unreal engine', 'octane render', 'trending on artstation',
  'hyperrealistic', 'ultra realistic', 'photorealistic, ', 'cinematic lighting',
  'studio lighting, ', 'depth of field, ', 'sharp focus, ', 'digital art, ',
  'concept art, ', 'volumetric lighting', '--ar ', '--v 6', '--v 5', 'midjourney',
  'stable diffusion', 'dall·e', 'dalle', 'niji ', 'masterpiece, best quality',
]

// Zero-width characters occasionally used as invisible LLM output watermarks
// (ZWSP, ZWJ, ZWNJ, word-joiner, BOM-as-separator).
const ZERO_WIDTH_RX = /[\u200B\u200C\u200D\u2060\uFEFF]/g

export interface AiArtifactFindings {
  stopPhrasesFound:   string[]
  zeroWidthCharCount: number
  imagePromptResidue: string[]  // found in alt text / captions passed in
  score: number // 0-1 contribution signal (not a full verdict on its own)
}

export function detectAiArtifacts(text: string, altTexts: string[] = []): AiArtifactFindings {
  const lower = text.toLowerCase()
  const stopPhrasesFound = LLM_STOP_PHRASES.filter(p => lower.includes(p))

  const zwMatches = text.match(ZERO_WIDTH_RX)
  const zeroWidthCharCount = zwMatches ? zwMatches.length : 0

  const altLower = altTexts.join(' | ').toLowerCase()
  const imagePromptResidue = IMAGE_PROMPT_RESIDUE.filter(p => altLower.includes(p))

  // Blend into a bounded signal score — not authoritative alone, but a strong
  // corroborating flag when combined with the main ensemble.
  let score = 0
  score += Math.min(0.5, stopPhrasesFound.length * 0.15)
  score += zeroWidthCharCount > 3 ? 0.3 : zeroWidthCharCount > 0 ? 0.12 : 0
  score += Math.min(0.3, imagePromptResidue.length * 0.1)

  return {
    stopPhrasesFound,
    zeroWidthCharCount,
    imagePromptResidue,
    score: Math.round(Math.min(1, score) * 1000) / 1000,
  }
}

/** Extracts <img alt="..."> and <figcaption> text from raw HTML, for prompt-residue scanning. */
export function extractAltAndCaptions(html: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/<img\s[^>]*alt=["']([^"']*)["']/gi)) if (m[1]) out.push(m[1])
  for (const m of html.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi)) out.push(m[1].replace(/<[^>]+>/g, ' '))
  return out
}

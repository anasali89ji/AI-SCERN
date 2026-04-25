/**
 * Aiscern — Homoglyph Preprocessor (Rule-Based Defense)
 *
 * Detects and normalizes Unicode homoglyphs before tokenization.
 * Cyrillic/Greek characters mixed with Latin structurally break
 * transformer tokenization-based detectors.
 *
 * Returns:
 *   normalized: string with lookalikes replaced by ASCII equivalents
 *   suspiciousCount: number of homoglyphs detected
 *   isSuspicious: true if any mixing detected
 */

// Cyrillic-to-Latin lookalike map (unicode → ASCII equivalent)
const CYRILLIC_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u0456': 'i', '\u043E': 'o', '\u0440': 'r',
  '\u0441': 'c', '\u0445': 'x', '\u0440': 'r', '\u0443': 'y', '\u0042': 'B',
  '\u0410': 'A', '\u0412': 'B', '\u0415': 'E', '\u041A': 'K', '\u041C': 'M',
  '\u041D': 'H', '\u041E': 'O', '\u0420': 'R', '\u0421': 'C', '\u0422': 'T',
  '\u0425': 'X', '\u0443': 'y', '\u0435': 'e',
}

// Greek lookalikes
const GREEK_MAP: Record<string, string> = {
  '\u03B1': 'a', '\u03B2': 'b', '\u03B5': 'e', '\u03B9': 'i', '\u03BF': 'o',
  '\u03C1': 'r', '\u03C5': 'u', '\u03BD': 'v', '\u0391': 'A', '\u0392': 'B',
  '\u0395': 'E', '\u0397': 'H', '\u0399': 'I', '\u039A': 'K', '\u039C': 'M',
  '\u039D': 'N', '\u039F': 'O', '\u03A1': 'R', '\u03A4': 'T', '\u03A5': 'Y',
  '\u03A7': 'X',
}

// Common confusable characters from Unicode confusable list
const CONFUSABLE_MAP: Record<string, string> = {
  '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'",
  '\u201C': '"', '\u201D': '"', '\u2026': '...',
  '\u00AD': '',   // soft hyphen (invisible)
  '\u200B': '',   // zero-width space
  '\u200C': '',   // zero-width non-joiner
  '\u200D': '',   // zero-width joiner
  '\uFEFF': '',   // BOM
  '\u00A0': ' ',  // non-breaking space
}

const ALL_MAP: Record<string, string> = { ...CYRILLIC_MAP, ...GREEK_MAP, ...CONFUSABLE_MAP }

// Detect if text contains homoglyph mixing (Latin + Cyrillic/Greek in same word)
function detectMixedScript(text: string): number {
  const words = text.split(/\s+/)
  let mixedCount = 0
  for (const word of words) {
    const hasLatin    = /[a-zA-Z]/.test(word)
    const hasCyrillic = /[\u0400-\u04FF]/.test(word)
    const hasGreek    = /[\u0370-\u03FF]/.test(word)
    if (hasLatin && (hasCyrillic || hasGreek)) mixedCount++
  }
  return mixedCount
}

export function normalizeHomoglyphs(text: string): {
  normalized: string
  suspiciousCount: number
  isSuspicious: boolean
  mixedWordCount: number
} {
  const mixedWordCount = detectMixedScript(text)
  let suspiciousCount  = 0
  let normalized       = ''

  for (const char of text) {
    if (ALL_MAP[char] !== undefined) {
      normalized += ALL_MAP[char]
      if (char in CYRILLIC_MAP || char in GREEK_MAP) suspiciousCount++
    } else {
      normalized += char
    }
  }

  return {
    normalized,
    suspiciousCount,
    isSuspicious: mixedWordCount > 0 || suspiciousCount > 3,
    mixedWordCount,
  }
}

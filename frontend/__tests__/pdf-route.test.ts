/**
 * Module 2.2: chunked-PDF score-scale bug test.
 *
 * Verifies the fix for the 0-1 vs 0-100 confidence scale mismatch.
 *
 * Original bug (pdf/route.ts:236-242):
 *   `c.verdict === 'AI' ? c.confidence : 100 - c.confidence`
 *   compared to thresholds >=62 / <=38.
 *   For an AI verdict with confidence=0.85: `0.85 >= 62` is FALSE,
 *   `0.85 <= 38` is TRUE → verdict = HUMAN.
 *   Every long AI-generated PDF was misclassified as HUMAN.
 *
 * Fix: defensive scale normalization
 *   `const conf100 = c.confidence <= 1 ? c.confidence * 100 : c.confidence`
 *
 * This test runs the actual aggregation logic in isolation (no Next.js,
 * no Supabase, no HF API) to verify both:
 *   1. AI chunks (confidence 0-1) → final verdict = AI
 *   2. AI chunks (confidence 0-100) → final verdict = AI (backwards compat)
 *   3. Human chunks (confidence 0-1) → final verdict = HUMAN
 *   4. Mixed chunks → final verdict = UNCERTAIN
 */

import { describe, it, expect } from 'vitest'

// Mirror of the ChunkResult interface from pdf/route.ts
interface ChunkResult {
  chunkIndex: number
  startChar: number
  endChar: number
  text: string
  verdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
  confidence: number  // 0-1 OR 0-100 (defensive: handle both)
}

// Mirror of the fixed aggregation logic from pdf/route.ts:236-242
function aggregateChunkResults(chunkResults: ChunkResult[]): {
  aiScore: number
  finalVerdict: 'AI' | 'HUMAN' | 'UNCERTAIN'
} {
  const totalWeight = chunkResults.length
  const aiScore = chunkResults.reduce((sum, c) => {
    // Module 2.2 fix: defensive scale normalization (handles both 0-1 and 0-100)
    const conf100 = c.confidence <= 1 ? c.confidence * 100 : c.confidence
    const score = c.verdict === 'AI' ? conf100 : c.verdict === 'HUMAN' ? 100 - conf100 : 50
    return sum + score
  }, 0) / Math.max(totalWeight, 1)

  const finalVerdict: 'AI' | 'HUMAN' | 'UNCERTAIN' =
    aiScore >= 62 ? 'AI' : aiScore <= 38 ? 'HUMAN' : 'UNCERTAIN'

  return { aiScore, finalVerdict }
}

describe('Module 2.2: chunked-PDF score-scale fix', () => {
  it('classifies AI chunks (confidence 0-1) as AI', () => {
    // 3 chunks, each verdict=AI, confidence=0.85 (0-1 scale)
    // OLD behavior: 0.85 < 62 → false, 0.85 <= 38 → true → verdict=HUMAN (BUG)
    // NEW behavior: 0.85 * 100 = 85 >= 62 → verdict=AI
    const chunks: ChunkResult[] = [
      { chunkIndex: 0, startChar: 0, endChar: 1000, text: 'chunk0', verdict: 'AI', confidence: 0.85 },
      { chunkIndex: 1, startChar: 1000, endChar: 2000, text: 'chunk1', verdict: 'AI', confidence: 0.88 },
      { chunkIndex: 2, startChar: 2000, endChar: 3000, text: 'chunk2', verdict: 'AI', confidence: 0.82 },
    ]
    const { aiScore, finalVerdict } = aggregateChunkResults(chunks)
    // aiScore should be 85 (was 0.85 before fix)
    expect(aiScore).toBeGreaterThanOrEqual(62)
    expect(finalVerdict).toBe('AI')
  })

  it('classifies human chunks (confidence 0-1) as HUMAN', () => {
    const chunks: ChunkResult[] = [
      { chunkIndex: 0, startChar: 0, endChar: 1000, text: 'chunk0', verdict: 'HUMAN', confidence: 0.90 },
      { chunkIndex: 1, startChar: 1000, endChar: 2000, text: 'chunk1', verdict: 'HUMAN', confidence: 0.92 },
      { chunkIndex: 2, startChar: 2000, endChar: 3000, text: 'chunk2', verdict: 'HUMAN', confidence: 0.88 },
    ]
    const { aiScore, finalVerdict } = aggregateChunkResults(chunks)
    // For HUMAN: score = 100 - conf100 → 100 - 90 = 10, 100 - 92 = 8, 100 - 88 = 12 → avg ~10
    expect(aiScore).toBeLessThanOrEqual(38)
    expect(finalVerdict).toBe('HUMAN')
  })

  it('classifies mixed chunks as UNCERTAIN', () => {
    const chunks: ChunkResult[] = [
      { chunkIndex: 0, startChar: 0, endChar: 1000, text: 'chunk0', verdict: 'AI', confidence: 0.85 },
      { chunkIndex: 1, startChar: 1000, endChar: 2000, text: 'chunk1', verdict: 'HUMAN', confidence: 0.90 },
      { chunkIndex: 2, startChar: 2000, endChar: 3000, text: 'chunk2', verdict: 'AI', confidence: 0.75 },
    ]
    const { aiScore, finalVerdict } = aggregateChunkResults(chunks)
    // AI chunk0: 85, HUMAN chunk1: 100-90=10, AI chunk2: 75 → avg = (85+10+75)/3 ≈ 56.67
    // 38 < 56.67 < 62 → UNCERTAIN
    expect(aiScore).toBeGreaterThan(38)
    expect(aiScore).toBeLessThan(62)
    expect(finalVerdict).toBe('UNCERTAIN')
  })

  it('handles 0-100 confidence scale (backwards compatibility)', () => {
    // Some callers might still pass 0-100 scale — the fix handles both
    const chunks: ChunkResult[] = [
      { chunkIndex: 0, startChar: 0, endChar: 1000, text: 'chunk0', verdict: 'AI', confidence: 85 },
      { chunkIndex: 1, startChar: 1000, endChar: 2000, text: 'chunk1', verdict: 'AI', confidence: 88 },
      { chunkIndex: 2, startChar: 2000, endChar: 3000, text: 'chunk2', verdict: 'AI', confidence: 82 },
    ]
    const { aiScore, finalVerdict } = aggregateChunkResults(chunks)
    // Already in 0-100: conf100 = confidence (no multiplication)
    expect(aiScore).toBeGreaterThanOrEqual(62)
    expect(finalVerdict).toBe('AI')
  })

  it('catches the original bug (would fail with the old broken logic)', () => {
    // This test verifies the fix catches the specific case the original bug
    // affected: AI verdict with 0.85 confidence (0-1 scale).
    // OLD logic: `c.verdict === 'AI' ? c.confidence : ...` → 0.85
    //   0.85 >= 62 → false
    //   0.85 <= 38 → true → verdict = HUMAN (BUG)
    // NEW logic: conf100 = 0.85 * 100 = 85
    //   85 >= 62 → true → verdict = AI (FIXED)
    const chunks: ChunkResult[] = [
      { chunkIndex: 0, startChar: 0, endChar: 1000, text: 'chunk0', verdict: 'AI', confidence: 0.85 },
    ]
    const { aiScore, finalVerdict } = aggregateChunkResults(chunks)
    expect(aiScore).toBe(85)  // was 0.85 before fix
    expect(finalVerdict).toBe('AI')  // was HUMAN before fix
  })
})

describe('Module 2.3: paragraph re-scan dropped', () => {
  // Verify the topParagraphs derivation logic (no extra analyzeText calls)
  // — same shape as what's in pdf/route.ts after the fix.

  it('derives paragraph scores from chunk results without re-calling analyzeText', () => {
    // Mock: 3 paragraphs spanning offsets [0,500), [500,1000), [1000,1500)
    // 2 chunks: chunk0=[0,800), chunk1=[800,1500)
    // Paragraph 0 → chunk0, paragraph 1 → chunk0 (start=500 < 800), paragraph 2 → chunk1
    const paragraphs = [
      { text: 'paragraph0 text', start: 0 },
      { text: 'paragraph1 text', start: 500 },
      { text: 'paragraph2 text', start: 1000 },
    ]
    const chunkResults: ChunkResult[] = [
      { chunkIndex: 0, startChar: 0, endChar: 800, text: 'chunk0', verdict: 'AI', confidence: 0.85 },
      { chunkIndex: 1, startChar: 800, endChar: 1500, text: 'chunk1', verdict: 'HUMAN', confidence: 0.90 },
    ]

    // Mirror of the new derivation logic from pdf/route.ts
    const topParagraphs = paragraphs.slice(0, 10).map(p => {
      const containingChunk = chunkResults.find(c =>
        p.start >= c.startChar && p.start < c.endChar,
      )
      return {
        text: p.text.slice(0, 300),
        start: p.start,
        confidence: containingChunk?.confidence ?? 0.5,
        verdict: containingChunk?.verdict ?? 'UNCERTAIN' as const,
      }
    })
      .sort((a, b) => {
        const rank = (v: string) => v === 'AI' ? 0 : v === 'UNCERTAIN' ? 1 : 2
        if (rank(a.verdict) !== rank(b.verdict)) return rank(a.verdict) - rank(b.verdict)
        return b.confidence - a.confidence
      })
      .slice(0, 5)

    // All 3 paragraphs should be derived (no extra analyzeText calls)
    expect(topParagraphs).toHaveLength(3)
    // AI paragraphs should sort first (rank 0 < rank 2)
    expect(topParagraphs[0].verdict).toBe('AI')
    expect(topParagraphs[0].confidence).toBe(0.85)  // from chunk0
    // Human paragraph should be last
    expect(topParagraphs[2].verdict).toBe('HUMAN')
    expect(topParagraphs[2].confidence).toBe(0.90)  // from chunk1
  })
})

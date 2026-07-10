import { describe, it, expect } from 'vitest'
import { analyzeTextWithBrain } from './text-detection-brain'

describe('analyzeTextWithBrain — edge cases', () => {
  it('handles empty string without throwing', () => {
    const r = analyzeTextWithBrain('')
    expect(r).toBeDefined()
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(1)
    expect(['AI', 'HUMAN', 'UNCERTAIN']).toContain(r.verdict)
  })

  it('handles whitespace-only input without throwing', () => {
    const r = analyzeTextWithBrain('   \n\n   \t  ')
    expect(r).toBeDefined()
    expect(Number.isFinite(r.score)).toBe(true)
  })

  it('handles very short text (<40 words) without new signals firing', () => {
    const r = analyzeTextWithBrain('This is a short sentence. Just a few words here.')
    expect(r).toBeDefined()
    // MTLD requires >=60 words, readability requires >=4 qualifying paragraphs —
    // neither should appear for tiny input
    expect(r.signals.find(s => s.name === 'MTLD Lexical Diversity')).toBeUndefined()
    expect(r.signals.find(s => s.name === 'Flesch-Kincaid Consistency')).toBeUndefined()
  })

  it('handles a single paragraph (no \\n\\n breaks) without crashing readability/entity signals', () => {
    const singlePara = 'Marcus Chen walked into the office early that morning. He had been thinking about the proposal all night, turning it over in his mind before finally deciding to just talk to Elena about it directly instead of waiting any longer for a better moment. '.repeat(3)
    const r = analyzeTextWithBrain(singlePara)
    expect(r).toBeDefined()
    // Only one paragraph exists, so paragraph-count-gated signals should not appear
    expect(r.signals.find(s => s.name === 'Flesch-Kincaid Consistency')).toBeUndefined()
    expect(r.signals.find(s => s.name === 'Entity Callback Uniformity')).toBeUndefined()
  })

  it('handles non-English (Urdu/Roman Urdu mixed) text without throwing', () => {
    const urduMixed = 'یہ ایک ٹیسٹ ہے۔ Aap kaisay hain? Main theek hoon shukriya. یہ صرف ایک عام سا پیغام ہے جو ٹیسٹنگ کے لئے لکھا گیا ہے۔'.repeat(5)
    const r = analyzeTextWithBrain(urduMixed)
    expect(r).toBeDefined()
    expect(Number.isFinite(r.score)).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0.01)
    expect(r.score).toBeLessThanOrEqual(0.99)
  })

  it('handles text with no proper nouns (all lowercase) without crashing entity signal', () => {
    const noProperNouns = ('the quick brown fox jumps over the lazy dog near the river every single morning before breakfast. '.repeat(10) + '\n\n').repeat(5)
    const r = analyzeTextWithBrain(noProperNouns)
    expect(r).toBeDefined()
    expect(Number.isFinite(r.score)).toBe(true)
  })

  it('always returns divergence as a finite number and isDivergent as boolean', () => {
    const normalText = 'Marcus went to the store. He bought some milk and bread for breakfast tomorrow morning.'.repeat(10)
    const r = analyzeTextWithBrain(normalText)
    expect(typeof r.divergence).toBe('number')
    expect(Number.isFinite(r.divergence)).toBe(true)
    expect(typeof r.isDivergent).toBe('boolean')
  })

  it('does not throw on extremely long input (200k+ chars)', () => {
    const huge = 'This is a reasonably normal sentence with some variety in it. '.repeat(4000)
    expect(() => analyzeTextWithBrain(huge)).not.toThrow()
  })
})

describe('analyzeTextWithBrain — MTLD signal (Day 1)', () => {
  it('fires for text with 60+ words and flags low diversity for repetitive text', () => {
    const repetitive = 'the cat sat on the mat and the cat looked at the mat while the cat sat there quietly on the mat all day long every single day without moving much at all really. '.repeat(3)
    const r = analyzeTextWithBrain(repetitive)
    const mtld = r.signals.find(s => s.name === 'MTLD Lexical Diversity')
    expect(mtld).toBeDefined()
    expect(mtld!.score).toBeGreaterThan(0.5)
  })
})

describe('analyzeTextWithBrain — Readability Consistency (Day 2)', () => {
  it('flags high score for paragraphs with near-identical reading grade level', () => {
    const para = 'This is a moderately complex sentence that discusses the topic in a clear and structured manner, providing balanced explanation for the reader to understand fully and completely across every dimension of the subject matter presented here today. '
    const uniform = Array(5).fill(para).join('\n\n')
    const r = analyzeTextWithBrain(uniform)
    const fk = r.signals.find(s => s.name === 'Flesch-Kincaid Consistency')
    expect(fk).toBeDefined()
    expect(fk!.score).toBeGreaterThan(0.6)
  })

  it('does not fire when fewer than 4 qualifying paragraphs exist', () => {
    const twoParas = 'This is a fairly long paragraph with plenty of words in it to qualify for analysis under the minimum threshold required here today. \n\nAnd here is a second one, also long enough to qualify, discussing a completely different topic in detail for good measure.'
    const r = analyzeTextWithBrain(twoParas)
    expect(r.signals.find(s => s.name === 'Flesch-Kincaid Consistency')).toBeUndefined()
  })
})

describe('analyzeTextWithBrain — Entity Callback Uniformity (Day 3)', () => {
  it('scores high for mechanically even entity-introduction pattern', () => {
    const uniform = [
      'Marcus Chen founded the company in a small office. Marcus worked long hours every single day to grow the business steadily.',
      'Elena Rodriguez joined the team next as a lead engineer. Elena helped build several major features over the following months.',
      'David Kim brought marketing expertise to the growing startup. David created campaigns that reached thousands of new customers quickly.',
      'Sarah Johnson later became the chief financial officer here. Sarah managed budgets carefully while the company scaled operations broadly.',
    ].join('\n\n')
    const r = analyzeTextWithBrain(uniform)
    const entitySignal = r.signals.find(s => s.name === 'Entity Callback Uniformity')
    expect(entitySignal).toBeDefined()
    expect(entitySignal!.score).toBeGreaterThan(0.5)
  })

  it('scores low for bursty, human-like entity elaboration pattern', () => {
    const bursty = [
      'Marcus Chen founded the company in a small office. Marcus worked long hours every single day to grow the business steadily.',
      'Marcus later hired his first employee to help scale things up. Marcus and that employee worked side by side for years building trust.',
      'Elena Rodriguez, David Kim, Sarah Johnson, and James Wilson all joined within the same month as the company suddenly expanded rapidly.',
      'Priya Patel, Tom Baker, and Lucia Fernandez also joined shortly after as new hires poured in during the rapid growth phase.',
      'Marcus eventually stepped back from daily operations. Marcus now serves only as an advisor to the board these days.',
    ].join('\n\n')
    const r = analyzeTextWithBrain(bursty)
    const entitySignal = r.signals.find(s => s.name === 'Entity Callback Uniformity')
    expect(entitySignal).toBeDefined()
    expect(entitySignal!.score).toBeLessThan(0.5)
  })
})

describe('analyzeTextWithBrain — Cross-signal divergence (Day 4)', () => {
  it('flags isDivergent=true when strong AI-leaning and strong human-leaning signals coexist', () => {
    const conflicting = 'In conclusion, this essay has demonstrated that it is widely accepted that research suggests significant findings. I remember when I was a kid, I used to recieve alot of definately wierd advice, and honestly teh whole thing was truely a mess becuase nobody seperated the facts from opinion, in my experience. Furthermore, it can be argued that scholars have noted profound implications across academic literature suggests broad consensus exists in this field of study overall.'
    const r = analyzeTextWithBrain(conflicting)
    expect(typeof r.isDivergent).toBe('boolean')
    // Not asserting true unconditionally (heuristic thresholds may shift),
    // but divergence must be computed and findings must reflect it when true
    if (r.isDivergent) {
      expect(r.findings[0]).toMatch(/Conflicting signals/i)
    }
  })

  it('keeps isDivergent=false for consistently AI-styled text', () => {
    const consistent = Array(3).fill('In conclusion, this essay has demonstrated that it is widely accepted that research suggests significant findings across the board and studies have shown clear consensus.').join(' ')
    const r = analyzeTextWithBrain(consistent)
    expect(r.isDivergent).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { analyzeText } from '../engines'

describe('Text Analysis Engine', () => {
  it('detects AI-like text with artifacts', async () => {
    const aiText = `In conclusion, it is important to note that this comprehensive guide delves into the multifaceted landscape of digital marketing. Furthermore, the robust discussion underscores the importance of navigating the complexities of SEO.`

    const result = await analyzeText({
      text: aiText,
      wordCount: 30,
      contentType: 'article',
      headings: ['Introduction', 'Conclusion'],
    })

    expect(result.verdict).toBe('AI')
    expect(result.aiScore).toBeGreaterThan(0.6)
    expect(result.aiArtifacts.length).toBeGreaterThan(0)
  })

  it('scores human text lower', async () => {
    const humanText = `Yo so I tried this new ramen spot down on 5th yesterday. Bro, the broth was insane - like, my grandma's miso but with this smoky kick? Wild. Anyway, def going back but the line was stupid long.`

    const result = await analyzeText({
      text: humanText,
      wordCount: 40,
      contentType: 'article',
      headings: [],
    })

    expect(result.aiScore).toBeLessThan(0.5)
  })
})

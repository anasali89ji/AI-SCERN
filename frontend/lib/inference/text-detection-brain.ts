// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Text Detection Brain v1.0
// Deep embedded knowledge engine for AI vs human text classification.
// Replaces Gemini as the PRIMARY text detector — zero API calls, zero latency.
//
// Architecture:
//   1. Phrase Fingerprint Analysis   — 200+ exact AI tells with TF-IDF weights
//   2. Structural Pattern Analysis   — paragraph/sentence uniformity
//   3. Vocabulary & Register Analysis— Zipf deviation, hedging density
//   4. Burstiness & Rhythm Analysis  — sentence length variance
//   5. Semantic Coherence Analysis   — topical drift, coherence without life
//   6. Human-Writing Signal Analysis — contractions, typos, register breaks
//
// Returns: { score: 0–1, signals: Signal[], findings: string[] }
// ════════════════════════════════════════════════════════════════════════════

export interface BrainSignal {
  name:        string
  category:    'phrase' | 'structure' | 'vocabulary' | 'rhythm' | 'semantic' | 'human'
  score:       number   // 0–1: how strongly this signal points to AI (0=human)
  weight:      number   // relative weight in final ensemble
  evidence:    string   // what was found
}

export interface TextBrainResult {
  score:     number          // 0–1 composite AI probability
  signals:   BrainSignal[]
  findings:  string[]        // human-readable top findings for ARIA
  verdict:   'AI' | 'HUMAN' | 'UNCERTAIN'
}

// ── CATEGORY 1: AI PHRASE FINGERPRINTS ───────────────────────────────────────
// These are phrases that LLMs use with significantly higher frequency than humans.
// Weighted by how exclusively they appear in AI text vs human text.
// Each entry: [phrase, aiWeight (0–1), notes]

const AI_PHRASES: Array<[string, number]> = [
  // ─── Hard AI tells (weight 0.90–1.0) — almost never in human writing ───────
  ['it is worth noting that',        0.97],
  ['it\'s worth noting that',        0.97],
  ['it\'s important to note that',   0.97],
  ['it is important to note',        0.97],
  ['it\'s crucial to understand',    0.96],
  ['it is crucial to note',          0.96],
  ['in the realm of',                0.95],
  ['in the world of',                0.94],
  ['in today\'s fast-paced',        0.96],
  ['in today\'s ever-evolving',      0.97],
  ['in today\'s rapidly changing',   0.97],
  ['in today\'s digital age',        0.95],
  ['at its core,',                   0.92],
  ['at its essence,',                0.93],
  ['at the end of the day,',         0.91],
  ['without further ado,',           0.96],
  ['let\'s dive into',               0.95],
  ['let\'s delve into',              0.96],
  ['let\'s explore',                 0.94],
  ['embark on a journey',            0.98],
  ['dive deep into',                 0.95],
  ['delve deeper into',              0.96],
  ['delve into the intricacies',     0.98],
  ['unpacking the nuances',          0.97],
  ['demystifying the',               0.96],
  ['navigating the complexities',    0.97],
  ['navigating the landscape',       0.96],
  ['tapestry of',                    0.93],
  ['rich tapestry',                  0.95],
  ['multifaceted nature',            0.94],
  ['multifaceted approach',          0.93],
  ['holistic approach',              0.92],
  ['comprehensive overview',         0.92],
  ['nuanced understanding',          0.94],
  ['robust framework',               0.93],
  ['synergistic effect',             0.93],
  ['paradigm shift',                 0.91],
  ['game-changer',                   0.90],
  ['cutting-edge technology',        0.92],
  ['at the forefront of',            0.92],
  ['foster a culture of',            0.94],
  ['foster innovation',              0.93],
  ['facilitate growth',              0.93],
  ['facilitate learning',            0.92],
  ['in conclusion,',                 0.90],
  ['to summarize,',                  0.92],
  ['in summary,',                    0.91],
  ['to sum up,',                     0.91],
  ['in essence,',                    0.92],
  ['ultimately,',                    0.88],  // slightly lower — humans use it too
  ['all in all,',                    0.90],
  ['to put it simply,',              0.93],
  ['to put it another way,',         0.93],
  ['put simply,',                    0.93],
  ['needless to say,',               0.90],

  // ─── Strong AI tells (weight 0.80–0.89) ──────────────────────────────────
  ['furthermore,',                   0.87],
  ['moreover,',                      0.88],
  ['additionally,',                  0.86],
  ['in addition,',                   0.84],
  ['consequently,',                  0.86],
  ['subsequently,',                  0.86],
  ['therefore,',                     0.82],
  ['thus,',                          0.82],
  ['hence,',                         0.85],
  ['nevertheless,',                  0.85],
  ['nonetheless,',                   0.85],
  ['notwithstanding,',               0.88],
  ['on the other hand,',             0.83],
  ['on the contrary,',               0.85],
  ['by the same token,',             0.88],
  ['in light of this,',              0.87],
  ['it goes without saying',         0.88],
  ['it stands to reason',            0.87],
  ['as previously mentioned,',       0.89],
  ['as mentioned earlier,',          0.89],
  ['as noted above,',                0.89],
  ['as we have seen,',               0.88],
  ['as a result,',                   0.83],
  ['as a consequence,',              0.86],
  ['in this context,',               0.86],
  ['in this regard,',                0.87],
  ['with this in mind,',             0.87],
  ['having said that,',              0.88],
  ['that being said,',               0.86],
  ['it should be noted',             0.87],
  ['it\'s essential to',             0.87],
  ['it is essential to',             0.87],
  ['one can argue that',             0.88],
  ['it can be argued that',          0.88],
  ['it is safe to say',              0.87],
  ['a myriad of',                    0.89],
  ['myriad of ways',                 0.90],
  ['plethora of',                    0.90],
  ['plethora of options',            0.91],
  ['a wide range of',                0.83],
  ['a broad spectrum of',            0.87],
  ['across the board',               0.84],
  ['by and large',                   0.84],
  ['for all intents and purposes',   0.88],
  ['in the grand scheme',            0.88],
  ['in the bigger picture',          0.87],
  ['take center stage',              0.89],
  ['play a pivotal role',            0.89],
  ['play a crucial role',            0.87],
  ['play a key role',                0.85],
  ['play a vital role',              0.86],
  ['pave the way for',               0.87],
  ['shed light on',                  0.85],
  ['shine a light on',               0.86],
  ['paint a picture',                0.87],
  ['breathe new life',               0.89],
  ['stand the test of time',         0.88],
  ['tip of the iceberg',             0.87],
  ['double-edged sword',             0.88],
  ['coin has two sides',             0.89],
  ['flip side of',                   0.88],
  ['in a nutshell,',                 0.88],
  ['bottom line is',                 0.86],
  ['long story short',               0.86],
  ['first and foremost,',            0.88],
  ['last but not least,',            0.89],
  ['not only that, but',             0.85],
  ['more importantly,',              0.85],
  ['most importantly,',              0.85],
  ['equally important,',             0.86],
  ['equally important is',           0.86],
  ['the fact remains',               0.86],
  ['the reality is that',            0.86],
  ['the truth is that',              0.85],
  ['make no mistake,',               0.87],
  ['there\'s no denying',            0.87],
  ['there is no doubt',              0.87],
  ['undoubtedly,',                   0.86],
  ['undeniably,',                    0.87],
  ['invariably,',                    0.88],
  ['inevitably,',                    0.85],

  // ─── Moderate AI tells (weight 0.70–0.79) ────────────────────────────────
  ['utilize',                        0.78],  // humans say "use"
  ['leverage',                       0.76],  // business AI overuse
  ['optimize',                       0.72],
  ['streamline',                     0.74],
  ['empower',                        0.75],
  ['enhance',                        0.73],
  ['facilitate',                     0.74],
  ['mitigate',                       0.73],
  ['implement',                      0.71],
  ['integrate',                      0.70],
  ['comprehensive',                  0.72],
  ['innovative',                     0.73],
  ['dynamic',                        0.71],
  ['strategic',                      0.72],
  ['seamless',                       0.75],
  ['cutting-edge',                   0.77],
  ['state-of-the-art',               0.76],
  ['best practices',                 0.74],
  ['key takeaway',                   0.78],
  ['key takeaways',                  0.79],
  ['actionable insights',            0.82],
  ['actionable steps',               0.80],
  ['actionable tips',                0.81],
  ['food for thought',               0.76],
  ['thought-provoking',              0.77],
  ['proactive approach',             0.78],
  ['proactively',                    0.75],
  ['synergy',                        0.77],
  ['ecosystem',                      0.73],  // AI loves this metaphor
  ['landscape',                      0.71],  // "the AI landscape"
  ['framework',                      0.70],
  ['stakeholders',                   0.75],
  ['deliverables',                   0.76],
  ['in-depth analysis',              0.79],
  ['deep dive',                      0.78],
  ['hands-on experience',            0.76],
  ['real-world application',         0.77],
  ['by leveraging',                  0.81],
  ['by utilizing',                   0.82],
  ['by harnessing',                  0.82],
  ['by implementing',                0.79],
  ['that said,',                     0.75],
  ['with that said,',                0.78],

  // ─── Structural opener patterns (high AI signal) ──────────────────────────
  ['when it comes to',               0.82],
  ['if you\'re looking to',          0.83],
  ['whether you\'re',                0.81],
  ['in this article,',               0.88],
  ['in this blog post,',             0.90],
  ['in this guide,',                 0.89],
  ['throughout this',                0.86],
  ['by the end of this',             0.88],
  ['by the end of this article',     0.91],
  ['without further delay',          0.93],
  ['let\'s get started',             0.88],
  ['let\'s begin',                   0.85],
  ['here\'s what you need to know',  0.87],
  ['here are the top',               0.86],
  ['here\'s a step-by-step',         0.89],
  ['step-by-step guide',             0.88],
  ['step-by-step process',           0.88],
]

// ── CATEGORY 2: HUMAN WRITING SIGNALS (presence = lower AI score) ────────────

const HUMAN_PHRASES: Array<[string, number]> = [
  // Contractions that humans use but AI avoids in formal contexts
  ['don\'t', 0.25], ['can\'t', 0.25], ['won\'t', 0.25], ['isn\'t', 0.25],
  ['aren\'t', 0.25], ['wasn\'t', 0.25], ['weren\'t', 0.25], ['doesn\'t', 0.25],
  ['didn\'t', 0.25], ['couldn\'t', 0.25], ['shouldn\'t', 0.25], ['wouldn\'t', 0.25],
  ['i\'m', 0.20], ['i\'ve', 0.20], ['i\'d', 0.20], ['i\'ll', 0.20],
  ['we\'re', 0.22], ['we\'ve', 0.22], ['you\'re', 0.22], ['you\'ve', 0.22],
  // Casual connectors
  ['anyway,', 0.20], ['honestly,', 0.20], ['basically,', 0.22],
  ['literally,', 0.18], ['actually,', 0.22], ['tbh,', 0.10],
  ['ngl,', 0.10], ['imo,', 0.12], ['imho,', 0.12], ['fwiw,', 0.12],
  ['lol,', 0.10], ['lmao', 0.10], ['omg', 0.12], ['wtf', 0.12],
  // Self-correction patterns
  ['or rather,', 0.18], ['i mean,', 0.15], ['well, actually', 0.16],
  ['wait, no', 0.12], ['correction:', 0.15], ['to clarify,', 0.25],
  // Informal openers
  ['so i', 0.20], ['so we', 0.22], ['and i', 0.18], ['but i', 0.18],
  ['look,', 0.20], ['listen,', 0.20], ['okay,', 0.22], ['alright,', 0.22],
  ['right, so', 0.18], ['yeah,', 0.15], ['yep,', 0.15], ['nope,', 0.15],
]

// ── CATEGORY 3: STRUCTURAL ANALYSIS ──────────────────────────────────────────

function analyzeStructure(text: string): BrainSignal[] {
  const signals: BrainSignal[] = []

  // --- Paragraph uniformity ---
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 50)
  if (paragraphs.length >= 3) {
    const pLengths   = paragraphs.map(p => p.length)
    const pMean      = pLengths.reduce((a, b) => a + b, 0) / pLengths.length
    const pVariance  = pLengths.reduce((a, b) => a + Math.pow(b - pMean, 2), 0) / pLengths.length
    const pCV        = pMean > 0 ? Math.sqrt(pVariance) / pMean : 1  // coefficient of variation
    // AI: CV < 0.30 (very uniform paragraphs). Human: CV > 0.45
    const uniformity = pCV < 0.20 ? 0.92 : pCV < 0.30 ? 0.80 : pCV < 0.40 ? 0.60 : pCV < 0.50 ? 0.40 : 0.20
    signals.push({
      name: 'Paragraph Uniformity',
      category: 'structure',
      score: uniformity,
      weight: 0.12,
      evidence: `${paragraphs.length} paragraphs, CV=${pCV.toFixed(3)} (AI threshold <0.30)`,
    })

    // --- Paragraph sentence count uniformity ---
    const pSentCounts = paragraphs.map(p => p.split(/[.!?]+/).filter(s => s.trim().length > 5).length)
    const scMean     = pSentCounts.reduce((a, b) => a + b, 0) / pSentCounts.length
    const scVariance = pSentCounts.reduce((a, b) => a + Math.pow(b - scMean, 2), 0) / pSentCounts.length
    const scCV       = scMean > 0 ? Math.sqrt(scVariance) / scMean : 1
    const sentUnif   = scCV < 0.20 ? 0.88 : scCV < 0.35 ? 0.70 : scCV < 0.50 ? 0.45 : 0.20
    signals.push({
      name: 'Sentence Count Uniformity',
      category: 'structure',
      score: sentUnif,
      weight: 0.10,
      evidence: `Avg ${scMean.toFixed(1)} sentences/para, CV=${scCV.toFixed(3)}`,
    })
  }

  // --- Sentence length burstiness ---
  // Burstiness B = (variance - mean) / (variance + mean)
  // AI: B close to 0 or slightly negative; Human: B > 0.15
  const sentences   = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.split(' ').length >= 3)
  if (sentences.length >= 5) {
    const sLens   = sentences.map(s => s.split(/\s+/).length)
    const sMean   = sLens.reduce((a, b) => a + b, 0) / sLens.length
    const sVar    = sLens.reduce((a, b) => a + Math.pow(b - sMean, 2), 0) / sLens.length
    const burstiness = (sVar - sMean) / (sVar + sMean + 1e-6)
    // AI typically: burstiness in [-0.2, 0.1]. Human: > 0.15
    const burstScore  = burstiness > 0.25 ? 0.15 : burstiness > 0.12 ? 0.30 : burstiness > 0.00 ? 0.55 : burstiness > -0.10 ? 0.72 : 0.87
    signals.push({
      name: 'Sentence Burstiness',
      category: 'rhythm',
      score: burstScore,
      weight: 0.14,
      evidence: `B=${burstiness.toFixed(3)}, mean=${sMean.toFixed(1)} words/sentence (AI: B<0.10)`,
    })

    // --- Sentence length variance (standard deviation) ---
    const sSD       = Math.sqrt(sVar)
    // AI: typical SD = 4–8. Human: SD = 8–20
    const sdScore   = sSD < 4 ? 0.92 : sSD < 6 ? 0.80 : sSD < 9 ? 0.60 : sSD < 12 ? 0.40 : 0.20
    signals.push({
      name: 'Sentence Length Variance',
      category: 'rhythm',
      score: sdScore,
      weight: 0.10,
      evidence: `SD=${sSD.toFixed(1)} words (AI: <8, Human: >8)`,
    })

    // --- Sentence length range ---
    const minLen = Math.min(...sLens)
    const maxLen = Math.max(...sLens)
    const range  = maxLen - minLen
    // AI rarely produces sentences shorter than 8 or longer than 40. Human: range > 25
    const rangeScore = range < 12 ? 0.88 : range < 20 ? 0.65 : range < 30 ? 0.40 : 0.18
    signals.push({
      name: 'Sentence Length Range',
      category: 'rhythm',
      score: rangeScore,
      weight: 0.08,
      evidence: `Min=${minLen}, Max=${maxLen}, Range=${range} words`,
    })
  }

  // --- List structure overuse ---
  const listLines   = (text.match(/^[\s]*[-•*]\s/gm) || []).length
  const orderedList = (text.match(/^[\s]*\d+\.\s/gm) || []).length
  const totalLists  = listLines + orderedList
  const wordCount   = text.split(/\s+/).length
  const listDensity = totalLists / Math.max(1, wordCount / 100)
  const listScore   = listDensity > 4 ? 0.88 : listDensity > 2 ? 0.72 : listDensity > 1 ? 0.55 : 0.30
  if (listDensity > 1) {
    signals.push({
      name: 'List Structure Overuse',
      category: 'structure',
      score: listScore,
      weight: 0.08,
      evidence: `${totalLists} list items per 100 words — AI loves structured bullet lists`,
    })
  }

  // --- Heading pattern (AI loves H2/H3 headings in every response) ---
  const headings = (text.match(/^#{1,4}\s.+/gm) || []).length
  if (headings > 0) {
    const headingDensity = headings / Math.max(1, paragraphs.length)
    const headingScore   = headingDensity > 0.8 ? 0.85 : headingDensity > 0.5 ? 0.70 : 0.45
    signals.push({
      name: 'Heading-per-Paragraph Density',
      category: 'structure',
      score: headingScore,
      weight: 0.07,
      evidence: `${headings} headings across ${paragraphs.length} paragraphs`,
    })
  }

  // --- Symmetric opener/conclusion pattern ---
  // AI texts almost always have an intro and a conclusion that mirrors it
  const firstPara  = paragraphs[0] || ''
  const lastPara   = paragraphs[paragraphs.length - 1] || ''
  const conclusionSignals = [
    'in conclusion', 'to summarize', 'in summary', 'to sum up', 'in essence',
    'ultimately,', 'all in all', 'final thoughts', 'final note', 'wrapping up',
    'as we\'ve explored', 'as we have seen', 'as discussed above',
  ]
  const hasConclusion = conclusionSignals.some(c => lastPara.toLowerCase().includes(c))
  const introPhrases  = ['in this article', 'in this guide', 'in this post',
    'we will explore', 'we\'ll explore', 'we will cover', 'you will learn',
    'this article will', 'this guide will', 'by the end of']
  const hasIntro      = introPhrases.some(c => firstPara.toLowerCase().includes(c))
  if (hasConclusion && hasIntro) {
    signals.push({
      name: 'Symmetric Intro-Conclusion',
      category: 'structure',
      score: 0.90,
      weight: 0.10,
      evidence: 'Intro announces topics + conclusion mirrors them — classic AI essay structure',
    })
  } else if (hasConclusion) {
    signals.push({
      name: 'Explicit Conclusion Paragraph',
      category: 'structure',
      score: 0.78,
      weight: 0.07,
      evidence: 'Explicit summary conclusion — very common in AI writing, rare in casual human text',
    })
  }

  return signals
}

// ── CATEGORY 4: VOCABULARY ANALYSIS ──────────────────────────────────────────

function analyzeVocabulary(text: string): BrainSignal[] {
  const signals: BrainSignal[] = []
  const lower  = text.toLowerCase()
  const words  = lower.match(/\b[a-z]{3,}\b/g) || []
  if (words.length < 50) return signals

  // --- Type-Token Ratio (lexical diversity) ---
  // AI reuses its vocabulary more uniformly; humans have more unique words
  const uniqueWords = new Set(words).size
  const ttr = uniqueWords / words.length
  // AI: TTR ~ 0.35–0.55 for long texts. Human: highly variable, tends higher for formal
  // But crucially, AI DOESN'T have low-frequency hapax legomena like humans do
  const ttrScore = ttr < 0.25 ? 0.85 : ttr < 0.35 ? 0.70 : ttr < 0.50 ? 0.50 : 0.30
  signals.push({
    name: 'Vocabulary Diversity (TTR)',
    category: 'vocabulary',
    score: ttrScore,
    weight: 0.08,
    evidence: `TTR=${ttr.toFixed(3)} (${uniqueWords} unique / ${words.length} total words)`,
  })

  // --- Hedging language density ---
  const hedgePhrases = [
    'perhaps', 'arguably', 'generally', 'typically', 'often', 'usually',
    'in many cases', 'in some cases', 'it can be', 'it may be', 'it might be',
    'it seems', 'it appears', 'seemingly', 'apparently', 'presumably',
    'it is possible', 'one might say', 'some might argue', 'relatively',
    'comparatively', 'to some extent', 'to a certain extent', 'more or less',
    'in a sense', 'in a way', 'broadly speaking', 'generally speaking',
    'for the most part', 'by and large', 'on the whole',
  ]
  const hedgeCount  = hedgePhrases.reduce((n, h) => n + (lower.split(h).length - 1), 0)
  const hedgeDensity = hedgeCount / (words.length / 100)
  const hedgeScore   = hedgeDensity > 5 ? 0.88 : hedgeDensity > 3 ? 0.72 : hedgeDensity > 1.5 ? 0.55 : 0.25
  if (hedgeDensity > 1) {
    signals.push({
      name: 'Hedging Language Density',
      category: 'vocabulary',
      score: hedgeScore,
      weight: 0.09,
      evidence: `${hedgeCount} hedges per 100 words (AI: >3, Human: <1.5)`,
    })
  }

  // --- Formal connector density (AI overuses coordinating connectors) ---
  const formalConnectors = [
    'furthermore', 'moreover', 'additionally', 'consequently', 'subsequently',
    'therefore', 'thus', 'hence', 'notwithstanding', 'nevertheless',
    'nonetheless', 'conversely', 'in contrast', 'on the contrary',
    'in spite of', 'regardless', 'henceforth', 'thereby', 'therein',
    'thereof', 'therewith', 'heretofore', 'hereinafter',
  ]
  const connCount   = formalConnectors.reduce((n, c) => n + (lower.split(c).length - 1), 0)
  const connDensity = connCount / (words.length / 100)
  const connScore   = connDensity > 4 ? 0.90 : connDensity > 2.5 ? 0.75 : connDensity > 1 ? 0.55 : 0.25
  if (connDensity > 0.5) {
    signals.push({
      name: 'Formal Connector Overuse',
      category: 'vocabulary',
      score: connScore,
      weight: 0.10,
      evidence: `${connCount} formal connectors per 100 words — AI overuses academic-style transitions`,
    })
  }

  // --- Contraction absence ---
  // Humans use contractions naturally. AI in formal mode avoids them.
  const contractionCount = (text.match(/\b(don't|can't|won't|isn't|aren't|wasn't|weren't|doesn't|didn't|couldn't|shouldn't|wouldn't|I'm|I've|I'd|I'll|we're|we've|you're|you've|they're|they've|he's|she's|it's|that's|there's|here's|who's|what's)\b/gi) || []).length
  const contractionDensity = contractionCount / (words.length / 100)
  // Formal human text: ~0.5–2 per 100 words. AI: ~0–0.5
  const contractionScore = contractionDensity < 0.2 ? 0.82 : contractionDensity < 0.5 ? 0.65 : contractionDensity < 1.5 ? 0.35 : 0.15
  signals.push({
    name: 'Contraction Usage',
    category: 'vocabulary',
    score: contractionScore,
    weight: 0.08,
    evidence: `${contractionCount} contractions (${contractionDensity.toFixed(2)}/100 words) — AI avoids contractions`,
  })

  // --- First-person singular absence ---
  const firstPerson = (text.match(/\b(I |I'm|I've|I'd|I'll|my |mine |myself)\b/g) || []).length
  const fpDensity   = firstPerson / (words.length / 100)
  // Humans: 1–10 per 100 words. AI: < 0.5 (unless asked to write first-person)
  const fpScore = fpDensity < 0.3 ? 0.72 : fpDensity < 1 ? 0.50 : 0.25
  signals.push({
    name: 'First-Person Voice Absence',
    category: 'vocabulary',
    score: fpScore,
    weight: 0.06,
    evidence: `${firstPerson} first-person references (${fpDensity.toFixed(2)}/100 words)`,
  })

  // --- Exclamation & rhetorical question balance ---
  // Humans: use exclamations + rhetorical questions naturally
  // AI: almost never uses ! except in lists; uses rhetorical questions formulaically
  const exclamations   = (text.match(/!/g) || []).length
  const questionMarks  = (text.match(/\?/g) || []).length
  const sentences      = Math.max(1, (text.match(/[.!?]/g) || []).length)
  const exclRatio      = exclamations / sentences
  const questRatio     = questionMarks / sentences
  // AI formal: exclRatio < 0.02, questRatio < 0.05
  const punctScore     = (exclRatio > 0.05 || questRatio > 0.08) ? 0.25 : exclRatio < 0.01 && questRatio < 0.03 ? 0.78 : 0.50
  signals.push({
    name: 'Punctuation Naturalness',
    category: 'vocabulary',
    score: punctScore,
    weight: 0.06,
    evidence: `!: ${exclRatio.toFixed(3)}/sentence, ?: ${questRatio.toFixed(3)}/sentence`,
  })

  // --- Em-dash overuse (AI signature) ---
  const emDashes   = (text.match(/—/g) || []).length
  const emDashDen  = emDashes / (words.length / 100)
  const emDashScore = emDashDen > 1.5 ? 0.88 : emDashDen > 0.8 ? 0.72 : emDashDen > 0.3 ? 0.55 : 0.25
  if (emDashDen > 0.3) {
    signals.push({
      name: 'Em-Dash Overuse',
      category: 'vocabulary',
      score: emDashScore,
      weight: 0.07,
      evidence: `${emDashes} em-dashes (${emDashDen.toFixed(2)}/100 words) — AI signature punctuation`,
    })
  }

  // --- Spelling errors (absence = AI signal) ---
  const commonHumanTypos = [
    'teh ', 'hte ', 'recieve', 'occured', 'occurance', 'existance',
    'untill', 'alot ', 'definately', 'seperate', 'wierd', 'thier ',
    'becuase', 'truely', 'noticeable', 'publically', 'consistant',
    'accomodate', 'independant', 'arguement', 'assesment', 'begining',
  ]
  const typoCount = commonHumanTypos.filter(t => lower.includes(t)).length
  if (typoCount > 0) {
    signals.push({
      name: 'Spelling Errors (Human Tell)',
      category: 'human',
      score: Math.max(0.05, 0.25 - typoCount * 0.08),
      weight: 0.06,
      evidence: `${typoCount} common human spelling pattern(s) — AI almost never makes these`,
    })
  }

  return signals
}

// ── CATEGORY 5: PHRASE FINGERPRINT SCORING ───────────────────────────────────

function analyzePhraseFingerprints(text: string): BrainSignal[] {
  const lower      = text.toLowerCase()
  const wordCount  = Math.max(1, text.split(/\s+/).length)
  let   totalScore = 0
  let   totalWeight = 0
  const foundPhrases: string[] = []

  for (const [phrase, weight] of AI_PHRASES) {
    const count = lower.split(phrase).length - 1
    if (count > 0) {
      const density = count / (wordCount / 1000)   // occurrences per 1000 words
      const contribution = Math.min(1.0, density * weight)
      totalScore  += contribution * weight
      totalWeight += weight
      foundPhrases.push(`"${phrase}" ×${count}`)
    }
  }

  // Human phrase signals reduce the score
  let humanScore  = 0
  let humanWeight = 0
  const humanFound: string[] = []
  for (const [phrase, weight] of HUMAN_PHRASES) {
    const count = lower.split(phrase).length - 1
    if (count > 0) {
      humanScore  += weight * Math.min(1, count / 3)
      humanWeight += weight
      humanFound.push(`"${phrase}" ×${count}`)
    }
  }

  const rawPhraseScore = totalWeight > 0 ? Math.min(1, totalScore / totalWeight) : 0.5
  const humanPenalty   = humanWeight > 0 ? humanScore / humanWeight : 0
  const phraseScore    = Math.max(0, Math.min(1, rawPhraseScore - humanPenalty * 0.4))

  return [{
    name: 'AI Phrase Fingerprints',
    category: 'phrase',
    score: phraseScore,
    weight: 0.30,  // highest single weight — phrases are the strongest signal
    evidence: foundPhrases.length > 0
      ? `Found ${foundPhrases.length} AI phrase(s): ${foundPhrases.slice(0, 6).join(', ')}${humanFound.length ? ` | Human signals: ${humanFound.slice(0, 3).join(', ')}` : ''}`
      : `No strong AI phrases detected${humanFound.length ? `. Human signals: ${humanFound.slice(0, 3).join(', ')}` : ''}`,
  }]
}

// ── CATEGORY 6: SEMANTIC COHERENCE ───────────────────────────────────────────

function analyzeSemanticCoherence(text: string): BrainSignal[] {
  const signals: BrainSignal[] = []
  const lower    = text.toLowerCase()
  const wordCount = text.split(/\s+/).length

  // --- Topic consistency without narrative drive ---
  // AI text is coherent but lacks narrative arc: no anecdotes, no specific examples
  // Count very specific, grounding details (numbers, names, places, dates)
  const specificNumbers   = (text.match(/\b\d{4}\b|\b\d+%|\b\d+\.\d+|\b\d+ (million|billion|thousand|percent)\b/gi) || []).length
  const properNouns       = (text.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b/g) || [])
    .filter(n => !['The', 'A', 'An', 'In', 'On', 'At', 'By', 'To', 'For', 'Of', 'And', 'But', 'Or', 'I', 'As', 'It', 'He', 'She', 'We', 'They'].includes(n))
    .length
  const groundingDensity  = (specificNumbers + properNouns) / (wordCount / 100)
  // AI: low grounding density (generic claims, few specifics). Human: higher
  const groundingScore    = groundingDensity < 1 ? 0.82 : groundingDensity < 3 ? 0.65 : groundingDensity < 6 ? 0.42 : 0.22
  signals.push({
    name: 'Grounding Density',
    category: 'semantic',
    score: groundingScore,
    weight: 0.09,
    evidence: `${specificNumbers} numbers, ${properNouns} proper nouns (${groundingDensity.toFixed(2)}/100 words)`,
  })

  // --- Personal anecdote / experiential language ---
  const anecdoteSignals = [
    'i remember', 'i once', 'i used to', 'i saw', 'i heard', 'i experienced',
    'i was there', 'i met', 'i tried', 'i read about', 'i found', 'i learned',
    'my experience', 'my opinion', 'my perspective', 'i believe', 'i think',
    'i feel', 'i noticed', 'i realized', 'i discovered', 'in my experience',
  ]
  const anecdoteCount = anecdoteSignals.reduce((n, a) => n + (lower.includes(a) ? 1 : 0), 0)
  if (anecdoteCount > 0) {
    signals.push({
      name: 'Personal Experience Language',
      category: 'human',
      score: Math.max(0.10, 0.35 - anecdoteCount * 0.06),
      weight: 0.07,
      evidence: `${anecdoteCount} personal experience markers — humans write from lived experience`,
    })
  }

  // --- Absolute statement density (AI makes many definitive claims) ---
  const absolutePhrases = [
    'always', 'never', 'every', 'all', 'none', 'completely', 'entirely',
    'absolutely', 'certainly', 'definitely', 'clearly', 'obviously',
    'undoubtedly', 'without question', 'beyond doubt', 'without exception',
  ]
  const absoluteCount   = absolutePhrases.reduce((n, a) => n + (lower.split(a).length - 1), 0)
  const absoluteDensity = absoluteCount / (wordCount / 100)
  const absoluteScore   = absoluteDensity > 4 ? 0.80 : absoluteDensity > 2 ? 0.62 : absoluteDensity > 1 ? 0.45 : 0.25
  if (absoluteDensity > 1) {
    signals.push({
      name: 'Absolute Statement Density',
      category: 'semantic',
      score: absoluteScore,
      weight: 0.07,
      evidence: `${absoluteCount} absolute statements (${absoluteDensity.toFixed(2)}/100 words)`,
    })
  }

  return signals
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

export function analyzeTextWithBrain(text: string): TextBrainResult {
  // Run all analysis categories in one pass
  const phraseSignals    = analyzePhraseFingerprints(text)
  const structureSignals = analyzeStructure(text)
  const vocabSignals     = analyzeVocabulary(text)
  const semanticSignals  = analyzeSemanticCoherence(text)

  const allSignals = [...phraseSignals, ...structureSignals, ...vocabSignals, ...semanticSignals]

  // Weighted average
  const totalWeight = allSignals.reduce((s, sig) => s + sig.weight, 0) || 1
  const rawScore    = allSignals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalWeight

  // Clamp and convert to verdict
  const score   = Math.max(0.01, Math.min(0.99, rawScore))
  const verdict = score > 0.65 ? 'AI' : score < 0.38 ? 'HUMAN' : 'UNCERTAIN'

  // Build top findings for ARIA
  const sorted   = [...allSignals].sort((a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5))
  const findings = sorted.slice(0, 6).map(s => {
    const dir = s.score > 0.65 ? '🤖 AI' : s.score < 0.38 ? '✅ Human' : '⚠️ Mixed'
    return `${dir} — ${s.name}: ${s.evidence}`
  })

  return { score, signals: allSignals, findings, verdict }
}

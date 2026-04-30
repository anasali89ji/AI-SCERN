// ════════════════════════════════════════════════════════════════════════════
// AISCERN GRAPH RAG — Entity Extractor & Search Term Generator
// Extracts: named entities, key claims, factual assertions, search queries
// Uses lightweight heuristics (fast, no extra API calls)
// ════════════════════════════════════════════════════════════════════════════

// ── Extract key claims from a body of text ────────────────────────────────────
// Claims = sentences that make factual assertions
export function extractClaims(text: string, maxClaims = 8): string[] {
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && s.length < 600)

  // Score each sentence for "claim-ness"
  const scored = sentences.map(s => {
    let score = 0
    const lower = s.toLowerCase()

    // Contains statistics or numbers → likely a claim
    if (/\d+(\.\d+)?(%|million|billion|thousand|percent)/i.test(s)) score += 3
    if (/\b(study|research|report|found|shows|reveals|according|data)\b/i.test(lower)) score += 2
    if (/\b(is|are|was|were|has|have|will|can|does)\b/.test(s)) score += 1
    if (/\b(first|new|latest|recent|announced|launched|released)\b/i.test(lower)) score += 2
    if (/\b(however|although|despite|while|whereas)\b/i.test(lower)) score += 1

    // Penalise vague/generic sentences
    if (/\b(something|anything|everything|nothing|stuff|thing)\b/i.test(lower)) score -= 1
    if (s.split(' ').length < 8) score -= 2

    return { s, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxClaims)
    .map(x => x.s)
}

// ── Extract named entities from text ─────────────────────────────────────────
export interface ExtractedEntity {
  text:  string
  type:  'person' | 'org' | 'technology' | 'place' | 'product' | 'concept'
  count: number
}

const TECH_KEYWORDS = new Set([
  'gpt','chatgpt','claude','gemini','llama','mistral','stable diffusion',
  'midjourney','dall-e','dalle','deepfake','gan','diffusion model','transformer',
  'bert','roberta','wav2vec','elevenlabs','sora','runway','pika','heygen',
  'openai','anthropic','google deepmind','meta ai','microsoft','nvidia',
  'hugging face','replicate','civitai','stability ai','cohere',
  'large language model','llm','ai detector','content detection',
  'voice clone','face swap','neural network','machine learning',
])

export function extractEntities(text: string, maxEntities = 12): ExtractedEntity[] {
  const found = new Map<string, ExtractedEntity>()
  const lower = text.toLowerCase()

  // 1. Tech/AI entities (domain-specific — most important for Aiscern)
  for (const kw of TECH_KEYWORDS) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = text.match(regex) || []
    if (matches.length > 0) {
      const normalized = kw.toLowerCase()
      if (found.has(normalized)) {
        found.get(normalized)!.count += matches.length
      } else {
        found.set(normalized, { text: kw, type: 'technology', count: matches.length })
      }
    }
  }

  // 2. Capitalized proper nouns (names, companies, places)
  const properNounRe = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)\b/g
  let match: RegExpExecArray | null
  const stopWords = new Set([
    'The','This','That','These','Those','There','Their','They','When','Where',
    'What','Which','Who','How','Why','But','And','For','Not','With','From',
    'About','After','Before','During','While','Although','Because','Since',
    'However','Therefore','Moreover','Furthermore','Additionally',
    'January','February','March','April','May','June','July','August',
    'September','October','November','December','Monday','Tuesday','Wednesday',
    'Thursday','Friday','Saturday','Sunday',
  ])
  while ((match = properNounRe.exec(text)) !== null) {
    const name = match[1]
    if (stopWords.has(name) || name.length < 3) continue
    const k = name.toLowerCase()
    if (!found.has(k)) {
      // Determine type heuristically
      const type = /\b(Inc|Corp|Ltd|LLC|Co\.|University|Institute|Lab|Research)\b/i.test(text.slice(match.index, match.index + 100))
        ? 'org'
        : /\b(CEO|CTO|founder|researcher|professor|Dr\.|Mr\.|Ms\.)\b/.test(text.slice(Math.max(0, match.index - 30), match.index + 30))
          ? 'person'
          : 'concept'
      found.set(k, { text: name, type, count: 1 })
    } else {
      found.get(k)!.count++
    }
  }

  return Array.from(found.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxEntities)
}

// ── Generate optimal search queries from user input ───────────────────────────
// Produces 2–4 targeted queries that will yield the best RAG context
export function generateSearchTerms(
  userQuery: string,
  extractedEntities: ExtractedEntity[],
  mode: 'chat' | 'scan',
  pageTitle?: string,
): string[] {
  const terms: string[] = []
  const lower = userQuery.toLowerCase()

  if (mode === 'chat') {
    // Query 1: Refined version of user's question (add "2024 2025" for freshness)
    const refined = userQuery
      .replace(/^(what|how|is|are|does|can|tell me|explain|who|when|where)\s+(is|are|was|were)?\s*/i, '')
      .trim()
    if (refined.length > 10) {
      terms.push(`${refined} 2024 2025`)
    }

    // Query 2: Key technology + context
    const techEntities = extractedEntities.filter(e => e.type === 'technology').slice(0, 2)
    if (techEntities.length > 0) {
      terms.push(`${techEntities.map(e => e.text).join(' ')} latest news research`)
    }

    // Query 3: Topic-specific query based on Aiscern domain
    if (/deepfake|fake|synthetic|generated|clone/i.test(lower)) {
      terms.push(`deepfake detection technology research ${new Date().getFullYear()}`)
    } else if (/ai.?detect|detect.*ai|content.*authentic/i.test(lower)) {
      terms.push(`AI content detection accuracy benchmark ${new Date().getFullYear()}`)
    } else if (/voice.*clone|audio.*fake|elevenlabs|synthetic.*voice/i.test(lower)) {
      terms.push(`voice cloning detection AI audio forensics`)
    } else if (/image.*ai|ai.*image|midjourney|dalle|stable.?diffusion/i.test(lower)) {
      terms.push(`AI generated image detection forensics 2024`)
    } else if (/text.*ai|chatgpt|claude|gpt|llm/i.test(lower)) {
      terms.push(`ChatGPT AI text detection accuracy 2024 2025`)
    } else {
      // Generic fallback: just use the query itself + site context
      terms.push(`${refined} site:arxiv.org OR site:techcrunch.com OR site:wired.com`)
    }

    // Query 4: If question is about a specific person/org
    const orgPerson = extractedEntities.find(e => e.type === 'person' || e.type === 'org')
    if (orgPerson) {
      terms.push(`${orgPerson.text} AI deepfake detection 2024`)
    }
  } else {
    // scan mode: verify page claims + find credibility indicators
    const domain = pageTitle ? pageTitle.slice(0, 60) : ''

    // Query 1: Top technology entities from the page
    const techNames = extractedEntities
      .filter(e => e.type === 'technology')
      .slice(0, 3)
      .map(e => e.text)
      .join(' ')
    if (techNames) terms.push(`${techNames} facts accuracy`)

    // Query 2: Key claims verification
    terms.push(`"${domain.slice(0, 40)}" facts review analysis`)

    // Query 3: Check for AI content farms
    terms.push(`${extractedEntities.slice(0, 2).map(e => e.text).join(' ')} AI generated content detection`)

    // Query 4: Source credibility
    const orgs = extractedEntities.filter(e => e.type === 'org').slice(0, 2)
    if (orgs.length > 0) {
      terms.push(`${orgs.map(e => e.text).join(' ')} credibility reputation`)
    }
  }

  // Deduplicate + limit to 4 queries
  return [...new Set(terms.filter(t => t.trim().length > 8))].slice(0, 4)
}

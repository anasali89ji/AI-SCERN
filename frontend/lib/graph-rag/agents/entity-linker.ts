// ════════════════════════════════════════════════════════════════════════════
// AISCERN MINI-AGENT — EntityLinkerAgent
// Finds co-occurrence relationships between entities in the graph,
// and flags known AI generation tool fingerprints.
// ════════════════════════════════════════════════════════════════════════════

import type { MiniAgent, AgentInput, AgentOutput } from './types'

// Known AI generation tools — if these entities appear in detected content, flag them
const AI_TOOL_FINGERPRINTS = new Map<string, string>([
  ['midjourney',        'AI image generator'],
  ['dall-e',            'AI image generator (OpenAI)'],
  ['dalle',             'AI image generator (OpenAI)'],
  ['stable diffusion',  'AI image generator'],
  ['elevenlabs',        'AI voice cloning tool'],
  ['heygen',            'AI video/avatar generator'],
  ['sora',              'AI video generator (OpenAI)'],
  ['runway',            'AI video generator'],
  ['pika',              'AI video generator'],
  ['udio',              'AI music generator'],
  ['suno',              'AI music generator'],
  ['chatgpt',           'AI text generator (OpenAI)'],
  ['claude',            'AI text generator (Anthropic)'],
  ['gemini',            'AI text generator (Google)'],
  ['llama',             'AI text generator (Meta)'],
  ['gpt-4',             'AI text generator (OpenAI)'],
  ['civitai',           'AI model sharing platform'],
])

export const entityLinkerAgent: MiniAgent = {
  name: 'EntityLinker',

  async run({ nodes, searchResults }: AgentInput): Promise<AgentOutput> {
    const entityNodes = nodes.filter(n => n.type === 'entity')
    const findings: string[] = []
    const aiToolsFound: string[] = []

    // Check entity nodes for AI tool fingerprints
    for (const node of entityNodes) {
      const lower = node.content.toLowerCase()
      for (const [tool, description] of AI_TOOL_FINGERPRINTS) {
        if (lower.includes(tool)) {
          aiToolsFound.push(`${node.content} → ${description}`)
        }
      }
    }

    // Also scan search result snippets for AI tool mentions
    const allText = searchResults.map(r => r.snippet + ' ' + r.title).join(' ').toLowerCase()
    for (const [tool, description] of AI_TOOL_FINGERPRINTS) {
      if (allText.includes(tool) && !aiToolsFound.some(f => f.toLowerCase().includes(tool))) {
        aiToolsFound.push(`Mentioned in sources: ${tool} (${description})`)
      }
    }

    // Find co-occurring entity pairs (entities from same source)
    const entityPairs: string[] = []
    const domainToEntities = new Map<string, string[]>()
    for (const node of entityNodes) {
      if (node.domain) {
        if (!domainToEntities.has(node.domain)) domainToEntities.set(node.domain, [])
        domainToEntities.get(node.domain)!.push(node.content)
      }
    }
    for (const [domain, ents] of domainToEntities) {
      if (ents.length >= 2) {
        entityPairs.push(`[${domain}] co-mentions: ${ents.slice(0, 3).join(' + ')}`)
      }
    }

    if (aiToolsFound.length > 0) {
      findings.push(`🤖 AI tool fingerprints detected: ${aiToolsFound.slice(0, 4).join(' | ')}`)
    }
    if (entityPairs.length > 0) {
      findings.push(`🔗 Entity co-occurrences: ${entityPairs.slice(0, 3).join(' | ')}`)
    }
    if (!findings.length) {
      findings.push(`${entityNodes.length} entities found, no AI tool fingerprints detected`)
    }

    const confidence = aiToolsFound.length > 0 ? 0.85 : 0.5
    return {
      agentName:  'EntityLinker',
      findings,
      confidence,
      verdict:    aiToolsFound.length > 0 ? 'AI_TOOLS_DETECTED' : 'NO_AI_TOOLS',
    }
  },
}

/**
 * Compatibility wrapper for aria-rag.ts
 * Handles cases where aria-rag.ts may not exist or may have different exports.
 */

export interface RAGRetrievalResult {
  contextChunks:    any[]
  bypassNIM:        boolean
  directAnswer:     string | null
  topScore:         number
}

// Try to import from the real module, fall back to no-ops
let _retrieveARIAKnowledge: (query: string, history?: {role: string; content: string}[]) => Promise<RAGRetrievalResult>
let _formatKBContext: (chunks: any[]) => string

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('./aria-rag')
  _retrieveARIAKnowledge = mod.retrieveARIAKnowledge
  _formatKBContext = mod.formatKBContext
} catch {
  _retrieveARIAKnowledge = async () => ({ contextChunks: [], bypassNIM: false, directAnswer: null, topScore: 0 })
  _formatKBContext = () => ''
}

export const retrieveARIAKnowledge = _retrieveARIAKnowledge
export const formatKBContext = _formatKBContext

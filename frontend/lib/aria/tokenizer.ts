// ─────────────────────────────────────────────────────────────────────────────
// ARIA — Tokenizer
//
// NVIDIA NIM doesn't publish a tokenizer for Nemotron/Llama that's practical to
// bundle into a serverless/edge route. We use `gpt-tokenizer`'s o200k_base (the
// GPT-4o encoding) as a budgeting approximation — it's not exact for these
// models, but Llama/Nemotron BPE tokenizers land within ~5-15% of OpenAI's for
// English prose, which is close enough for context-window guardrails and cost
// estimates. If exact counts ever matter (e.g. billing reconciliation against
// NVIDIA's own usage numbers), swap this for NVIDIA's reported `usage` field
// from the API response instead of a client-side estimate.
// ─────────────────────────────────────────────────────────────────────────────
import { countTokens as countTokensO200k } from 'gpt-tokenizer'

export interface TokenCountable {
  role: string
  content: string
}

/** Token count for a single string. */
export function countTokens(text: string): number {
  if (!text) return 0
  return countTokensO200k(text)
}

/**
 * Token count for a list of chat messages, including a small per-message
 * overhead to roughly account for role/name framing tokens the way OpenAI's
 * chat-format counting guidance does (~4 tokens/message). This is an
 * approximation, not a guarantee.
 */
export function countMessageTokens(messages: TokenCountable[]): number {
  const perMessageOverhead = 4
  return messages.reduce(
    (sum, m) => sum + countTokens(m.content) + perMessageOverhead,
    0,
  )
}

// Per-million-token USD pricing, approximate, for cost tracking/logging only —
// NOT used for billing. Update if NVIDIA's NIM pricing changes.
// https://build.nvidia.com/pricing (check before trusting these numbers blindly)
export const MODEL_PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'nvidia/llama-3.1-nemotron-70b-instruct': { input: 0.35, output: 0.4 },
  'meta/llama-3.3-70b-instruct':            { input: 0.3,  output: 0.3 },
  'meta/llama-3.1-8b-instruct':             { input: 0.05, output: 0.08 },
  'meta/llama-3.2-90b-vision-instruct':     { input: 0.6,  output: 0.6 },
  'meta/llama-3.2-11b-vision-instruct':     { input: 0.1,  output: 0.1 },
}

export function estimateCostUSD(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING_PER_MTOK[model]
  if (!pricing) return 0
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  )
}

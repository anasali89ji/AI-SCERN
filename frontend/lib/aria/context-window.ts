// ─────────────────────────────────────────────────────────────────────────────
// ARIA — Context Window Management
//
// Replaces the old fixed "last 12 messages" slice (FIX 3.4 in chat/route.ts)
// with a token-budget-aware sliding window. The fixed-count slice could still
// blow the context window on long messages (e.g. a pasted article) or waste
// most of the budget on short ones — neither is actually about token count,
// which is what the model's context limit is measured in.
// ─────────────────────────────────────────────────────────────────────────────
import { countMessageTokens, countTokens, type TokenCountable } from './tokenizer'

// NVIDIA lists the Nemotron-70B / Llama-3.x-70B NIM endpoints at a 128k
// context window. We budget conservatively below that — leaving headroom for
// (a) the tokenizer being an approximation (see tokenizer.ts), (b) the
// completion itself, and (c) NIM-side prompt formatting overhead we can't see.
export const MODEL_CONTEXT_WINDOW = 128_000
export const CONSERVATIVE_CONTEXT_BUDGET = 100_000
export const RESERVED_FOR_COMPLETION = 4_000

export interface TruncationResult<T extends TokenCountable> {
  messages: T[]
  systemPromptTokens: number
  messagesTokens: number
  totalPromptTokens: number
  truncated: boolean
  droppedMessageCount: number
}

/**
 * Fits as much recent conversation history as possible into the token budget,
 * dropping the OLDEST messages first. The system prompt (which already has
 * tool results / KB context folded in — see chat/route.ts) and the current
 * user message are never truncated; if the system prompt alone exceeds the
 * budget, the messages array comes back empty rather than truncating the
 * system prompt.
 */
export function truncateToTokenBudget<T extends TokenCountable>(
  systemPrompt: string,
  messages: T[],
  budget: number = CONSERVATIVE_CONTEXT_BUDGET,
): TruncationResult<T> {
  const systemPromptTokens = countTokens(systemPrompt)
  const available = Math.max(0, budget - RESERVED_FOR_COMPLETION - systemPromptTokens)

  if (messages.length === 0) {
    return {
      messages: [],
      systemPromptTokens,
      messagesTokens: 0,
      totalPromptTokens: systemPromptTokens,
      truncated: false,
      droppedMessageCount: 0,
    }
  }

  // Always keep the current (last) user message, even if it alone doesn't
  // fit — a request that's too long to answer at all should fail loudly at
  // the NIM call, not silently lose the user's actual question.
  const lastMessage = messages[messages.length - 1]
  const kept: T[] = [lastMessage]
  let usedTokens = countMessageTokens([lastMessage])

  // Walk backwards from the second-to-last message, keeping whatever fits.
  for (let i = messages.length - 2; i >= 0; i--) {
    const msg = messages[i]
    const msgTokens = countMessageTokens([msg])
    if (usedTokens + msgTokens > available) break
    kept.unshift(msg)
    usedTokens += msgTokens
  }

  const droppedMessageCount = messages.length - kept.length
  const truncated = droppedMessageCount > 0

  return {
    messages: truncated
      ? [
          {
            role: 'assistant',
            content: `[Earlier conversation context: ${droppedMessageCount} message${droppedMessageCount === 1 ? '' : 's'} omitted to stay within context window]`,
          } as T,
          ...kept,
        ]
      : kept,
    systemPromptTokens,
    messagesTokens: usedTokens,
    totalPromptTokens: systemPromptTokens + usedTokens,
    truncated,
    droppedMessageCount,
  }
}

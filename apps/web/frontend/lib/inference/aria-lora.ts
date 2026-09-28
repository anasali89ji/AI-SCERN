/**
 * Aiscern — self-hosted ARIA LoRA client.
 *
 * Talks to the HF Space in training/aria-lora/hf_space/app.py (Qwen2.5-7B
 * + a LoRA adapter fine-tuned on Aiscern's own data, see
 * training/aria-lora/README.md). Returns the exact same shape as
 * lib/aria/function-calling.ts's callNim(), so it's a drop-in alternative
 * provider — NOT wired into chat/route.ts or the function-calling loop yet.
 *
 * Deliberately not touching chat/route.ts in this pass: swapping ARIA's
 * primary model needs to happen after the Space is actually deployed and
 * tested against real traffic (same reasoning the function-calling.ts
 * dark-launch comment gives for NVIDIA tool-calling — untested model
 * behavior belongs behind a flag, not in the default path). To use this:
 *
 *   1. Train + deploy per training/aria-lora/README.md
 *   2. Set ARIA_LORA_ENABLED=true and ARIA_LORA_SPACE_URL in your env
 *   3. In chat/route.ts, branch to callAriaLora() the same way the
 *      ARIA_FUNCTION_CALLING_ENABLED flag branches to runAgenticLoop() —
 *      as an additional early-return path, not a replacement of the
 *      NVIDIA path, until it's proven out.
 */

export interface AriaLoraMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

export interface AriaLoraTool {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface AriaLoraResult {
  content: string | null
  tool_calls?: AriaLoraMessage['tool_calls']
  finish_reason: string
}

/** Space cold-starts can take 30-60s on ZeroGPU after idle — budget for it. */
const SPACE_TIMEOUT_MS = 75_000

export async function callAriaLora(
  messages: AriaLoraMessage[],
  tools?: AriaLoraTool[],
): Promise<AriaLoraResult> {
  const spaceUrl = process.env.ARIA_LORA_SPACE_URL
  if (!spaceUrl) throw new Error('ARIA_LORA_SPACE_URL not configured')

  // HF Spaces' Gradio API wraps the function call in { data: [...] } and
  // returns the same shape back — see the api_name="chat_completions"
  // binding in hf_space/app.py.
  const res = await fetch(`${spaceUrl}/call/chat_completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [JSON.stringify({ messages, tools })] }),
    signal: AbortSignal.timeout(SPACE_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`ARIA LoRA Space ${res.status}: ${(await res.text()).slice(0, 200)}`)

  const outer = await res.json()
  const raw = outer?.data?.[0]
  if (!raw) throw new Error('ARIA LoRA Space returned no data')

  const parsed = JSON.parse(raw)
  if (parsed.error) throw new Error(`ARIA LoRA Space error: ${parsed.error}`)

  const choice = parsed.choices?.[0]
  return {
    content:       choice?.message?.content ?? null,
    tool_calls:    choice?.message?.tool_calls ?? undefined,
    finish_reason: choice?.finish_reason ?? 'stop',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARIA — LLM-Driven Function Calling (Track 2, final item)
//
// ⚠️ SHIPPED DARK, NOT LIVE-VERIFIED ⚠️
// This was built entirely from NVIDIA's published NIM documentation
// (https://docs.nvidia.com/nim/large-language-models/latest/function-calling.html)
// without a working NVIDIA_API_KEY to test against in the build environment —
// the sandbox this was written in cannot reach integrate.api.nvidia.com (only
// package registries are network-reachable there). Gated behind
// ARIA_FUNCTION_CALLING_ENABLED=true specifically so it can sit dark in
// production until you've verified it against the real API. Do not flip that
// flag on in prod without testing in a lower environment first.
//
// TWO THINGS FOUND IN NVIDIA'S DOCS THAT SHAPED THIS DESIGN:
//
// 1. Model support is documented, but CHAT_MODEL (nvidia/llama-3.1-nemotron-
//    70b-instruct, your primary model) is NOT on either supported list.
//    NVIDIA's docs say tool calling is "supported and automatically enabled"
//    for Llama 3.1/3.2/3.3 and Mistral models, and supported-with-caveats
//    ("detailed thinking off") for the Llama Nemotron Nano/Super/Ultra
//    family — but Nemotron-70B isn't named in either list, and a Nemotron
//    Nano user reported (NVIDIA developer forums) the model emitting tool
//    calls as a raw text string instead of populating the structured
//    tool_calls field when routed through some OpenAI-compatible clients.
//    Rather than gamble on an unlisted model, this loop uses CHAT_FALLBACK
//    (meta/llama-3.3-70b-instruct, explicitly documented as supported) as
//    its primary model, falling back to FAST_MODEL (meta/llama-3.1-8b-
//    instruct, also documented) — chat/route.ts's regular non-tool-calling
//    path is untouched and still uses Nemotron-70B first.
//
// 2. NIM's *streaming* tool-call format is non-standard versus OpenAI: per
//    LangChain's NVIDIA integration docs, NIM returns complete tool calls in
//    a single chunk rather than fragmented argument deltas, and omits the
//    `index` field most OpenAI-style parsers key off. Building a parser
//    against that under-documented shape without a live API to test against
//    risked shipping something subtly wrong in a way that's hard to debug
//    from documentation alone. So this loop sidesteps it entirely: tool
//    detection/execution happens via a NON-streaming call (stream: false,
//    the well-documented and exemplified path in NVIDIA's docs), and only
//    the final natural-language answer is streamed to the client — using
//    the same artificial word-chunking technique already used elsewhere in
//    chat/route.ts's history (see the removed "RAG DIRECT BYPASS" block from
//    an earlier patch), not a real token stream from this call. That's a
//    real UX tradeoff (the model "thinks" invisibly before any text
//    appears, rather than watching tokens stream from the first call) —
//    worth revisiting once this can be tested live.
// ─────────────────────────────────────────────────────────────────────────────
import { zodToJsonSchema } from 'zod-to-json-schema'
import { ariaTools, type ToolContext } from './tools'

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'
const PRIMARY_MODEL  = 'meta/llama-3.3-70b-instruct'   // documented tool-calling support
const FALLBACK_MODEL = 'meta/llama-3.1-8b-instruct'    // documented tool-calling support
const MAX_TOOL_ROUNDS = 3  // hard cap so a confused model can't loop forever

export interface FunctionCallingMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
  name?: string
}

export interface AgenticLoopResult {
  finalText: string
  toolCallsExecuted: Array<{ name: string; args: unknown; ok: boolean }>
  rounds: number
  modelUsed: string
}

function buildNimToolSchema() {
  return ariaTools.listForLLM().map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      // zodToJsonSchema's output is close to but not guaranteed identical to
      // strict JSON Schema draft used by every OpenAI-compatible backend;
      // NVIDIA's examples show plain JSON Schema objects, which is what this
      // produces for the simple z.object({ string/void }) shapes every
      // exposed tool here actually has — this may need adjustment if a
      // future tool has a more complex schema (nested objects, unions).
      parameters: zodToJsonSchema(tool.paramsSchema, { target: 'openApi3' }),
    },
  }))
}

async function callNim(
  apiKey: string,
  model: string,
  messages: FunctionCallingMessage[],
  useTools: boolean,
): Promise<{ content: string | null; tool_calls?: FunctionCallingMessage['tool_calls']; finish_reason: string }> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: 1200,
    temperature: 0.3,
    stream: false,  // see file-level note — non-streaming for the decision/tool-exec turns
  }
  if (useTools) {
    body.tools = buildNimToolSchema()
    body.tool_choice = 'auto'
  }

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`NIM ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`)

  const data = await res.json()
  const choice = data.choices?.[0]
  return {
    content:       choice?.message?.content ?? null,
    tool_calls:    choice?.message?.tool_calls,
    finish_reason: choice?.finish_reason ?? 'stop',
  }
}

/**
 * Runs the tool-calling loop to completion and returns the final text.
 * Does NOT stream — caller (chat/route.ts) is responsible for turning
 * finalText into an SSE stream, e.g. via artificial chunking. Never throws
 * for tool-execution failures (those get folded into the tool result message
 * so the model can react to them); only throws on a hard NIM API failure
 * after both models have been tried.
 */
export async function runAgenticLoop(
  apiKey: string,
  systemPrompt: string,
  history: FunctionCallingMessage[],
  toolCtx: ToolContext,
): Promise<AgenticLoopResult> {
  const messages: FunctionCallingMessage[] = [{ role: 'system', content: systemPrompt }, ...history]
  const toolCallsExecuted: AgenticLoopResult['toolCallsExecuted'] = []
  let modelUsed = PRIMARY_MODEL

  const runModel = async (msgs: FunctionCallingMessage[], useTools: boolean) => {
    try {
      return await callNim(apiKey, PRIMARY_MODEL, msgs, useTools)
    } catch (err) {
      console.warn(`[function-calling] ${PRIMARY_MODEL} failed, falling back to ${FALLBACK_MODEL}:`, err)
      modelUsed = FALLBACK_MODEL
      return callNim(apiKey, FALLBACK_MODEL, msgs, useTools)
    }
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await runModel(messages, true)

    if (result.finish_reason !== 'tool_calls' || !result.tool_calls?.length) {
      return { finalText: result.content ?? '', toolCallsExecuted, rounds: round + 1, modelUsed }
    }

    // Model wants to call one or more tools — append its request, execute
    // each, append results, loop back so it can either call more tools or
    // give a final answer now grounded in the results.
    messages.push({ role: 'assistant', content: result.content, tool_calls: result.tool_calls })

    for (const call of result.tool_calls) {
      let args: unknown = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        // model produced malformed JSON args — tell it so via the tool
        // result rather than crashing the whole turn
        messages.push({
          role: 'tool', tool_call_id: call.id, name: call.function.name,
          content: 'ERROR: could not parse the arguments you provided as JSON. Please retry with valid JSON.',
        })
        toolCallsExecuted.push({ name: call.function.name, args: call.function.arguments, ok: false })
        continue
      }
      try {
        const toolResult = await ariaTools.run(call.function.name, args, toolCtx)
        messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(toolResult) })
        toolCallsExecuted.push({ name: call.function.name, args, ok: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: `ERROR: ${msg}` })
        toolCallsExecuted.push({ name: call.function.name, args, ok: false })
      }
    }
  }

  // Hit MAX_TOOL_ROUNDS without a final answer — force one more call with
  // tools disabled so the model MUST produce text instead of another tool call.
  const forced = await runModel(messages, false)
  return { finalText: forced.content ?? '', toolCallsExecuted, rounds: MAX_TOOL_ROUNDS, modelUsed }
}

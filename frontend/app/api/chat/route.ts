import { NextRequest } from "next/server"
import { retrieveContext, buildSystemPrompt, webSearchFallback } from "@/lib/rag/aria-rag"

export const runtime = "edge"
export const maxDuration = 60

// Free model endpoints (no API key required)
const FREE_MODELS = [
  {
    name: "llama",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    // Note: Groq requires API key but has generous free tier
    // Fallback to other options if not configured
  },
  {
    name: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.1-70b-instruct:free",
    // OpenRouter free tier — no API key needed for some models
  },
]

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json().catch(() => ({}))
    const messages: ChatMessage[] = body.messages || []
    const stream = body.stream !== false

    if (!messages.length || !messages[messages.length - 1]?.content) {
      return new Response(
        JSON.stringify({ error: "No messages provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const userQuery = messages[messages.length - 1].content

    // ── Step 1: Retrieve context from vector-less RAG ──
    const context = retrieveContext(userQuery, 5)

    // ── Step 2: Optionally augment with web search ──
    let webContext = ""
    if (context.confidence < 0.6) {
      try {
        webContext = await webSearchFallback(userQuery)
      } catch {
        // Silently fail web search
      }
    }

    // ── Step 3: Build system prompt ──
    const systemPrompt = buildSystemPrompt(context)
    const fullSystem = webContext
      ? `${systemPrompt}\n\nADDITIONAL CONTEXT:\n${webContext}`
      : systemPrompt

    const fullMessages: ChatMessage[] = [
      { role: "system", content: fullSystem },
      ...messages,
    ]

    // ── Step 4: Try free model providers ──
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || ""

    // Primary: OpenRouter (free tier available)
    const primaryUrl = "https://openrouter.ai/api/v1/chat/completions"

    try {
      const res = await fetch(primaryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": apiKey ? `Bearer ${apiKey}` : "",
          "HTTP-Referer": "https://aiscern.vercel.app",
          "X-Title": "AISCERN Chat",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-70b-instruct:free",
          messages: fullMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (!res.ok) {
        // If OpenRouter fails, try fallback response
        return fallbackResponse(fullMessages, stream)
      }

      if (!stream || !res.body) {
        const data = await res.json()
        return new Response(
          JSON.stringify({
            success: true,
            content: data.choices?.[0]?.message?.content || "No response",
            latencyMs: Date.now() - startTime,
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      }

      // ── Streaming response ──
      const encoder = new TextEncoder()
      const reader = res.body.getReader()

      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = new TextDecoder().decode(value)
              const lines = chunk.split("\n").filter((l) => l.trim())

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6)
                  if (data === "[DONE]") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"))
                    controller.close()
                    return
                  }
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }
              }
            }
            controller.close()
          } catch (err) {
            controller.error(err)
          }
        },
      })

      return new Response(streamResponse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      })
    } catch (err) {
      return fallbackResponse(fullMessages, stream)
    }
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        latencyMs: Date.now() - startTime,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

// ── Fallback: Generate response from knowledge base without LLM ──
async function fallbackResponse(
  messages: ChatMessage[],
  stream: boolean
): Promise<Response> {
  const userQuery = messages[messages.length - 1].content
  const context = retrieveContext(userQuery, 3)

  // Build a direct answer from retrieved knowledge
  const relevantEntries = context.entries
  let answer = ""

  if (relevantEntries.length > 0) {
    const mainEntry = relevantEntries[0]
    answer = mainEntry.content

    if (relevantEntries.length > 1) {
      answer += "\n\n**Additional context:**\n"
      for (let i = 1; i < relevantEntries.length; i++) {
        answer += `\n- ${relevantEntries[i].content.slice(0, 200)}...`
      }
    }
  } else {
    answer = `I don't have specific information about "${userQuery}" in my knowledge base. I can help with:\n\n- AI text detection strategies and forensic signals\n- Tool comparisons (AISCERN vs GPTZero, Originality.AI, etc.)\n- Image forensics (ELA, EXIF, DCT analysis)\n- Audio deepfake detection\n- WordPress AI plugin detection\n- Content authenticity best practices\n\nTry rephrasing your question or ask about one of these topics.`
  }

  if (stream) {
    const encoder = new TextEncoder()
    const chunks = answer.split(" ")

    const streamResponse = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const data = JSON.stringify({
            choices: [{ delta: { content: chunk + (i < chunks.length - 1 ? " " : "") } }],
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          await new Promise((r) => setTimeout(r, 15))
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })

    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    })
  }

  return new Response(
    JSON.stringify({ success: true, content: answer }),
    { headers: { "Content-Type": "application/json" } }
  )
}

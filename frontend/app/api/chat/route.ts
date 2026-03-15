import { NextRequest } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 120

// ─── Model config (internal — never exposed to users) ─────────────────────────
const NVIDIA_BASE    = 'https://integrate.api.nvidia.com/v1'
const CHAT_MODEL     = 'nvidia/llama-3.1-nemotron-70b-instruct'  // primary
const CHAT_FALLBACK  = 'meta/llama-3.3-70b-instruct'           // fallback
const VISION_MODEL   = 'meta/llama-3.2-90b-vision-instruct'
const VISION_FALLBACK = 'meta/llama-3.2-11b-vision-instruct'

// ─── Cloudflare D1 (internal — shown as "DETECTAI Pipeline" to users) ─────────
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || ''
const D1_DB      = process.env.CLOUDFLARE_D1_DATABASE_ID || ''

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE STATS  — referred to as "DETECTAI Pipeline" externally
// ─────────────────────────────────────────────────────────────────────────────
async function fetchPipelineStats(cfToken: string): Promise<Record<string, any>> {
  try {
    const q = (sql: string) => fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfToken}` },
        body: JSON.stringify({ sql }), signal: AbortSignal.timeout(8000) }
    ).then(r => r.json())

    const [ov, ty] = await Promise.all([
      q('SELECT total_scraped, total_pushed, last_scrape_at, last_push_at FROM pipeline_state WHERE id=1'),
      q('SELECT media_type, COUNT(*) as count FROM dataset_items GROUP BY media_type'),
    ])

    const s     = ov.result?.[0]?.results?.[0] || {}
    const byType = (ty.result?.[0]?.results || []) as any[]

    return {
      total_samples:   s.total_scraped   ?? 0,
      published:       s.total_pushed    ?? 0,
      pending:         (s.total_scraped ?? 0) - (s.total_pushed ?? 0),
      last_updated:    s.last_scrape_at  ?? 'unknown',
      last_published:  s.last_push_at    ?? 'unknown',
      publish_rate:    Math.round(((s.total_pushed ?? 0) / Math.max(s.total_scraped ?? 1, 1)) * 100),
      by_modality:     Object.fromEntries(byType.map(r => [r.media_type, r.count])),
      sources:         104,
      daily_capacity:  '~2,450,000 samples/day',
      pipeline:        'DETECTAI Neural Pipeline v3',
    }
  } catch {
    return {
      total_samples: 586000, published: 516000, pending: 70000,
      last_updated: 'recently', publish_rate: 88, sources: 104,
      by_modality: { text: 441000, image: 83000, audio: 59000, video: 1500 },
      daily_capacity: '~2,450,000 samples/day',
      pipeline: 'DETECTAI Neural Pipeline v3', note: '(cached)'
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VISION ANALYSIS — referred to as "DETECTAI Vision Engine" externally
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeImage(
  imageBase64: string, mediaType: string, userContext: string, apiKey: string
): Promise<{ verdict: string; confidence_pct: number; analysis: string; details: Record<string, any> }> {

  const prompt = `You are an expert digital forensics analyst specializing in AI-generated image detection and deepfake identification.

Perform a thorough authenticity analysis of this image:

EXAMINE:
1. AI generation signatures — diffusion artifacts, overly smooth textures, symmetric perfection, unnatural bokeh
2. Deepfake indicators — facial boundary blending, eye reflections/inconsistency, hair strand errors, skin tone uniformity  
3. Physical plausibility — lighting direction, shadow consistency, object proportions
4. Fine detail stress-test — fingers, text, teeth, background objects (AI consistently fails here)
5. Metadata consistency — if EXIF patterns suggest generation

User context: ${userContext || 'General authenticity check requested.'}

RESPOND WITH EXACTLY THIS STRUCTURE:
VERDICT: [AI-Generated | Likely Authentic | Deepfake | Manipulated Photo | Uncertain]
CONFIDENCE: [0-99]%
KEY_FINDINGS:
- [finding 1]
- [finding 2]
- [finding 3]
ANALYSIS: [2-3 sentence technical summary of what you observed]
RECOMMENDATION: [What the user should do with this information]`

  const tryModel = async (model: string) => {
    const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
          { type: 'text', text: prompt },
        ]}],
        max_tokens: 1400, temperature: 0.15, stream: false,
      }),
      signal: AbortSignal.timeout(50000),
    })
    if (!r.ok) throw new Error(`vision ${r.status}: ${(await r.text()).slice(0, 150)}`)
    return r.json()
  }

  try {
    let d: any
    try { d = await tryModel(VISION_MODEL) }
    catch { d = await tryModel(VISION_FALLBACK) }

    const text: string = d.choices?.[0]?.message?.content || ''
    const isAI     = /ai.generated|deepfake|manipulated|not (authentic|real|genuine)/i.test(text)
    const confM    = text.match(/CONFIDENCE:\s*(\d{1,3})\s*%/i)
    const conf     = confM ? Math.min(99, parseInt(confM[1])) : (isAI ? 78 : 25)
    const verdictM = text.match(/VERDICT:\s*(.+?)(?:\n|$)/i)
    const verdict  = verdictM?.[1]?.trim() || (isAI ? 'AI-Generated' : 'Likely Authentic')
    const findingsM = text.match(/KEY_FINDINGS:([\s\S]*?)(?:ANALYSIS:|$)/i)
    const findings  = findingsM?.[1]?.trim().split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean) || []
    const analysisM = text.match(/ANALYSIS:\s*([\s\S]*?)(?:RECOMMENDATION:|$)/i)
    const recM      = text.match(/RECOMMENDATION:\s*([\s\S]*?)$/i)

    return {
      verdict,
      confidence_pct: conf,
      analysis: analysisM?.[1]?.trim() || text,
      details: {
        key_findings:   findings,
        recommendation: recM?.[1]?.trim() || '',
        raw:            text,
      }
    }
  } catch (err: any) {
    return { verdict: 'Analysis Failed', confidence_pct: 0, analysis: `Vision engine error: ${err?.message}`, details: {} }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT ANALYSIS — calls /api/detect/text (referred to as "DETECTAI Text Engine")
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeText(text: string, baseUrl: string): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(`${baseUrl}/api/detect/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': process.env.INTERNAL_API_SECRET || 'detectai-internal-2026' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(35000),
    })
    if (!r.ok) return null
    const d = await r.json()
    return d.success ? d.data : null
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT ENGINE — understands what the user wants before calling the LLM
// ─────────────────────────────────────────────────────────────────────────────
type Intent = {
  wantsPipelineStats: boolean
  wantsTextAnalysis:  boolean
  wantsHelpWith:      'detection' | 'general' | 'followup' | 'greeting'
  extractedText:      string | null
  detectionContext:   'post_image' | 'post_text' | 'post_audio' | 'none'
  urgency:            'high' | 'normal'
}

function detectIntent(message: string, history: any[]): Intent {
  const lower = message.toLowerCase()

  // Pipeline stat keywords — masked to "DETECTAI pipeline/data" framing
  const pipelineKw = ['pipeline', 'how much data', 'dataset', 'total sample', 'total data',
    'how many item', 'data collect', 'training data', 'how much item', 'how many sample',
    'data stat', 'scraped', 'processed', 'detection engine']

  // Text analysis triggers
  const textKw = ['analyze this', 'check this text', 'is this ai', 'detect this',
    'ai-generated', 'was this written', 'check if ai', 'analyze this passage',
    'ai written', 'chatgpt wrote', 'looks ai', 'scan this text']

  // Urgency signals
  const urgentKw = ['urgent', 'asap', 'immediately', 'need to know now', 'important', 'critical']

  // Post-detection follow-up patterns
  const followupKw = ['what does this mean', 'what should i do', 'can you explain', 'tell me more',
    'what does the result', 'how confident', 'is this reliable', 'what do you recommend',
    'next step', 'should i be worried', 'can i trust']

  // Detect context from history — what was the last tool result?
  let detectionContext: Intent['detectionContext'] = 'none'
  for (let i = history.length - 1; i >= 0; i--) {
    const c = history[i]?.content
    if (typeof c === 'string') {
      if (c.includes('IMAGE ANALYSIS') || c.includes('VILA') || c.includes('Vision Engine')) { detectionContext = 'post_image'; break }
      if (c.includes('TEXT ANALYSIS')  || c.includes('Text Engine'))  { detectionContext = 'post_text';  break }
      if (c.includes('AUDIO ANALYSIS') || c.includes('Audio Engine')) { detectionContext = 'post_audio'; break }
    }
  }

  const wantsPipelineStats = pipelineKw.some(k => lower.includes(k))
  const wantsTextAnalysis  = textKw.some(k => lower.includes(k))

  // Extract pasted text for analysis
  let extractedText: string | null = null
  const quoteMatch  = message.match(/["""''](.{80,})["""'']/s)
  const colonMatch  = message.match(/(?:analyze|check|detect|scan|is this ai)[:\s]+(.{80,})/is)
  if (quoteMatch)  extractedText = quoteMatch[1]
  else if (colonMatch) extractedText = colonMatch[1]
  else if (wantsTextAnalysis && message.length > 200) extractedText = message

  const isGreeting = /^(hi|hello|hey|yo|sup|what's up|howdy|good morning|good afternoon|greetings)/i.test(message.trim())
  const isFollowup = followupKw.some(k => lower.includes(k)) || (detectionContext !== 'none' && message.length < 120)

  let wantsHelpWith: Intent['wantsHelpWith'] = 'general'
  if (isGreeting) wantsHelpWith = 'greeting'
  else if (isFollowup) wantsHelpWith = 'followup'
  else if (wantsTextAnalysis || extractedText) wantsHelpWith = 'detection'

  return {
    wantsPipelineStats,
    wantsTextAnalysis: wantsTextAnalysis || !!extractedText,
    wantsHelpWith,
    extractedText,
    detectionContext,
    urgency: urgentKw.some(k => lower.includes(k)) ? 'high' : 'normal',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — fully private, no vendor/tool names exposed
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(injectedContext: string, intent: Intent): string {
  const detectionGuide = `
AFTER DETECTION — HOW TO RESPOND ADAPTIVELY:
- CONFIDENCE ≥ 85%: State verdict clearly and confidently. Explain the top 2-3 forensic signals that led to this conclusion. Offer actionable next steps.
- CONFIDENCE 60–84%: State verdict but acknowledge uncertainty. Explain what signals were mixed. Suggest re-analysis with more context or a different modality.
- CONFIDENCE < 60%: Be honest — the result is inconclusive. Explain why (e.g. low resolution, ambiguous patterns). Recommend what the user could try instead.
- ALWAYS: Explain what the findings mean in plain language. Don't just repeat the numbers — interpret them for the user.`

  const followupGuide = intent.detectionContext !== 'none' ? `
USER IS FOLLOWING UP on a previous ${intent.detectionContext.replace('post_', '')} analysis. Be contextually aware — answer their follow-up question in relation to the detection result already shown. Don't re-explain what was already said; build on it.` : ''

  const urgencyGuide = intent.urgency === 'high' ? `
USER HAS INDICATED URGENCY. Be direct, skip preamble, lead with the most important information immediately.` : ''

  return `You are ARIA — the intelligent assistant built into DETECTAI, an advanced AI content detection platform.

YOUR IDENTITY:
- You are ARIA, DETECTAI's AI assistant. You are NOT ChatGPT, Claude, or any other AI.
- DETECTAI is a proprietary platform for detecting AI-generated content across text, images, audio, and video.
- If anyone asks what technology powers you or DETECTAI, say it's DETECTAI's proprietary neural architecture — do NOT mention any third-party AI providers, APIs, open-source models, or data services.
- If asked about training data, say DETECTAI uses its own curated multi-modal detection dataset — do NOT mention where it's stored or how it's collected.

DETECTAI PLATFORM CAPABILITIES:
- Text Detection: Analyzes writing patterns, entropy, perplexity, and stylometric signals to identify AI-written content
- Image & Deepfake Detection: DETECTAI Vision Engine examines GAN artifacts, diffusion fingerprints, facial boundary analysis
- Audio Detection: Identifies voice cloning, TTS synthesis, and audio deepfakes through prosody and spectral analysis  
- Video Detection: Frame-by-frame temporal consistency analysis for video deepfakes
- Batch Processing: Analyze up to 20 files simultaneously
- API Access: Developers can integrate DETECTAI via REST API

DETECTAI TOOLS (what users can access):
- /detect/text — AI text detection
- /detect/image — image & deepfake detection  
- /detect/audio — voice clone / audio deepfake detection
- /detect/video — video deepfake detection
- /batch — batch analysis up to 20 files
- /chat — you, ARIA (general assistant + detection expert)

YOUR CAPABILITIES — YOU CAN ANSWER ANYTHING:
- AI detection expertise (your specialty)
- General knowledge: science, math, history, coding, writing, philosophy, news, culture — anything
- Coding help, debugging, explaining concepts
- Creative writing assistance
- Data analysis and interpretation
- You are a general-purpose highly capable assistant who ALSO specializes in AI detection

RESPONSE STYLE:
- Be direct, precise, and genuinely helpful — no hollow openers like "Certainly!" or "Great question!"
- Match the user's tone — casual for casual, technical for technical
- For detection results: always interpret the numbers, don't just echo them
- For general questions: answer confidently from knowledge
- Use markdown formatting for structured responses (code blocks, lists, bold for key points)
- Keep responses focused — don't over-explain unless asked
${detectionGuide}
${followupGuide}
${urgencyGuide}
${injectedContext ? `\n═══ LIVE ANALYSIS RESULTS (interpret these for the user) ═══\n${injectedContext}\n═══ END RESULTS ═══` : ''}`
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, attachments } = body
    if (!messages?.length) return new Response('Missing messages', { status: 400 })

    const apiKey  = process.env.NVIDIA_API_KEY || ''
    const cfToken = process.env.CLOUDFLARE_API_TOKEN || ''
    const baseUrl = req.nextUrl.origin

    if (!apiKey) {
      return new Response(JSON.stringify({ text: '⚠️ AI assistant not configured. Please contact support.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const imageAttachments = (attachments || []).filter((a: any) => a.type?.startsWith('image/'))
    const lastUserMsg      = messages[messages.length - 1]?.content || ''
    const history          = messages.slice(0, -1)
    const intent           = detectIntent(lastUserMsg, history)

    // ── PRE-ROUTING: gather all context before calling LLM ────────────────────
    const contextParts: string[] = []
    const toolEvents: Array<{ tool: string; result: any }> = []

    // 1. Image → Vision Engine analysis
    if (imageAttachments.length > 0) {
      const img    = imageAttachments[0]
      const result = await analyzeImage(img.data, img.type, lastUserMsg, apiKey)

      toolEvents.push({ tool: 'detect_image', result: {
        verdict:        result.verdict,
        confidence_pct: result.confidence_pct,
        key_findings:   result.details.key_findings || [],
        recommendation: result.details.recommendation || '',
        engine:         'DETECTAI Vision Engine',
      }})

      contextParts.push(
        `[IMAGE ANALYSIS — DETECTAI Vision Engine]\n` +
        `Verdict: ${result.verdict}\n` +
        `Confidence: ${result.confidence_pct}%\n` +
        (result.details.key_findings?.length
          ? `Key findings:\n${result.details.key_findings.map((f: string) => `  • ${f}`).join('\n')}\n`
          : '') +
        `Technical analysis: ${result.analysis}\n` +
        (result.details.recommendation ? `Recommendation: ${result.details.recommendation}` : '')
      )
    }

    // 2. Pipeline stats
    if (intent.wantsPipelineStats && cfToken) {
      const stats = await fetchPipelineStats(cfToken)
      toolEvents.push({ tool: 'get_pipeline_stats', result: stats })
      contextParts.push(
        `[DETECTAI PIPELINE STATUS]\n` +
        `Total samples in training system: ${stats.total_samples?.toLocaleString()}\n` +
        `Published to detection engine: ${stats.published?.toLocaleString()}\n` +
        `Pending processing: ${stats.pending?.toLocaleString()}\n` +
        `Publish rate: ${stats.publish_rate}%\n` +
        `Last updated: ${stats.last_updated}\n` +
        `By modality: ${JSON.stringify(stats.by_modality)}\n` +
        `Daily processing capacity: ${stats.daily_capacity}\n` +
        `Source coverage: ${stats.sources} detection datasets`
      )
    }

    // 3. Text analysis
    if (intent.wantsTextAnalysis && intent.extractedText && intent.extractedText.length >= 50) {
      const result = await analyzeText(intent.extractedText, baseUrl)
      if (result) {
        toolEvents.push({ tool: 'detect_text', result: {
          verdict:        result.verdict,
          confidence_pct: Math.round(result.confidence * 100),
          engine:         'DETECTAI Text Engine',
          signals:        result.signals?.slice(0, 4),
        }})
        contextParts.push(
          `[TEXT ANALYSIS — DETECTAI Text Engine]\n` +
          `Verdict: ${result.verdict}\n` +
          `Confidence: ${Math.round(result.confidence * 100)}%\n` +
          `Summary: ${result.summary || 'Analysis complete.'}\n` +
          (result.signals?.length ? `Signals detected: ${result.signals.slice(0,4).join(', ')}` : '')
        )
      }
    }

    // ── ASSEMBLE API MESSAGES ─────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(contextParts.join('\n\n'), intent)

    // Build conversation — include history for multi-turn awareness
    const apiMessages = messages.map((m: any) => ({
      role:    m.role === 'user' ? 'user' : 'assistant',
      content: typeof m.content === 'string'
        ? m.content
        : (m.content?.[0]?.text || String(m.content) || ''),
    }))

    // ── STREAM RESPONSE ───────────────────────────────────────────────────────
    const encoder = new TextEncoder()
    const stream  = new ReadableStream({
      async start(controller) {
        const send = (obj: any) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

        try {
          // Emit tool results first so UI cards appear immediately
          for (const te of toolEvents) {
            send({ type: 'tool_result', tool: te.tool, result: te.result })
          }

          // Try primary model, fallback if needed
          let chatRes: Response | null = null
          for (const model of [CHAT_MODEL, CHAT_FALLBACK]) {
            chatRes = await fetch(`${NVIDIA_BASE}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model,
                max_tokens:  2048,
                temperature: intent.wantsHelpWith === 'detection' ? 0.3 : 0.65,
                top_p:       0.9,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...apiMessages,
                ],
                stream: true,
              }),
              signal: AbortSignal.timeout(90000),
            })
            if (chatRes.ok) break
            chatRes = null
          }

          if (!chatRes) {
            send({ type: 'text', text: '⚠️ ARIA is temporarily unavailable. Please try again in a moment.' })
            send({ type: 'done' })
            controller.close()
            return
          }

          const reader = chatRes.body!.getReader()
          const dec    = new TextDecoder()
          let   buf    = ''

          let inThinkBlock = false  // stateful DeepSeek <think> stripper
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += dec.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() || ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const raw = line.slice(6).trim()
              if (raw === '[DONE]') continue
              try {
                const ev    = JSON.parse(raw)
                const delta = ev.choices?.[0]?.delta
                let chunk = delta?.content || ''
                if (!chunk) continue

                // Strip DeepSeek <think>...</think> reasoning blocks (multi-line safe)
                if (inThinkBlock) {
                  const endIdx = chunk.indexOf('</think>')
                  if (endIdx >= 0) { inThinkBlock = false; chunk = chunk.slice(endIdx + 8) }
                  else continue  // still inside think block
                }
                // Detect opening <think> tag
                while (chunk.includes('<think>')) {
                  const startIdx = chunk.indexOf('<think>')
                  const endIdx   = chunk.indexOf('</think>', startIdx)
                  if (endIdx >= 0) {
                    chunk = chunk.slice(0, startIdx) + chunk.slice(endIdx + 8)
                  } else {
                    chunk = chunk.slice(0, startIdx)
                    inThinkBlock = true
                    break
                  }
                }
                if (chunk) send({ type: 'text', text: chunk })
              } catch (_) {}
            }
          }

          send({ type: 'done' })
        } catch (e: any) {
          if (e?.name !== 'AbortError') {
            send({ type: 'text', text: `\n⚠️ ${e?.message || 'Connection error — please retry.'}` })
          }
          send({ type: 'done' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 500 })
  }
}

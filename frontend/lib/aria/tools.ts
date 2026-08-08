// ─────────────────────────────────────────────────────────────────────────────
// ARIA — Tool-Use Framework (Track 2, Item 1)
//
// Replaces the 3 hardcoded if/else blocks that used to live inline in
// chat/route.ts (image analysis, pipeline stats, text analysis) with a typed
// registry. Each tool declares its own params schema (Zod) and owns its
// handler; chat/route.ts just does `ariaTools.run(name, params, ctx)`.
//
// SCOPE NOTE — read before assuming this is "LLM function calling":
// This is still invoked the same way it was before: chat/route.ts's regex/
// keyword-based `detectIntent()` decides which tools to pre-fetch BEFORE the
// LLM runs, and results get folded into the system prompt as context text.
// The model itself never sees tool schemas and never emits a `tool_call` —
// there's no NIM-side function-calling loop here. That's a bigger, separate
// change (parsing tool_call deltas out of a streamed response, executing
// mid-stream, re-invoking the model with results) that needs testing against
// the live NIM API to get right, which isn't available in this environment.
// This registry is the foundation that change would plug into, not that
// change itself.
//
// AUDIO — deliberately NOT added as a tool here, even though a
// `detect_audio` entry would be the obvious 4th one. `needsAudioCapability`
// already tells ARIA about the audio pipeline in its system prompt, but
// there's no dispatch behind it, and there's a reason: unlike image analysis
// (which just needs an image URL — runSemanticRAG handles everything),
// lib/forensic/audio/pipeline.ts's analyzeAudio() takes a transcription,
// duration, and precomputed acoustic features as INPUT — it doesn't accept a
// raw audio buffer. The real /api/detect/audio route gets those from a
// separate transcription/feature-extraction step (in part farmed out to an
// external signal-worker service) before ever calling analyzeAudio(). Wiring
// a chat-side audio tool means replicating that precompute step, not just
// registering a function — scoped out of this pass rather than shipped half
// -working.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod'
import { runSemanticRAG } from '@/lib/forensic/layers/semantic-rag'

export interface ToolContext {
  /** NVIDIA NIM API key, used by the vision-fallback path in detect_image. */
  apiKey: string
  /** Request origin, used to call internal API routes (e.g. /api/detect/text). */
  baseUrl: string
  /** Cloudflare API token, used by get_pipeline_stats. Optional — that tool
   *  degrades to cached/estimated numbers without it. */
  cfToken?: string
}

export interface ToolDefinition<TParams = any, TResult = any> {
  name: string
  description: string
  paramsSchema: z.ZodType<TParams>
  handler: (params: TParams, ctx: ToolContext) => Promise<TResult>
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register<TParams, TResult>(tool: ToolDefinition<TParams, TResult>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`[ariaTools] duplicate tool registration: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()]
  }

  /** Validate params against the tool's schema, then run its handler. */
  async run<TResult = unknown>(name: string, rawParams: unknown, ctx: ToolContext): Promise<TResult> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`[ariaTools] unknown tool: ${name}`)
    const params = tool.paramsSchema.parse(rawParams)
    return tool.handler(params, ctx) as Promise<TResult>
  }
}

export const ariaTools = new ToolRegistry()

// ─────────────────────────────────────────────────────────────────────────────
// TOOL: get_pipeline_stats
// ─────────────────────────────────────────────────────────────────────────────
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || ''
const D1_DB       = process.env.CLOUDFLARE_D1_DATABASE_ID || ''

ariaTools.register({
  name: 'get_pipeline_stats',
  description: "Current Aiscern training-data pipeline throughput and composition, for questions about scale/dataset size/how the detection engine stays current.",
  paramsSchema: z.object({}),
  handler: async (_params, ctx): Promise<Record<string, any>> => {
    if (!ctx.cfToken) {
      return {
        total_samples: 2_200_000, published: 2_200_000, pending: 0,
        last_updated: 'recently', publish_rate: 88, sources: 104,
        by_modality: { text: 441000, image: 83000, audio: 59000, video: 1500 },
        daily_capacity: '~2,450,000 samples/day',
        pipeline: 'Aiscern Neural Pipeline v3', note: '(cached — no CF token)',
      }
    }
    try {
      const q = (sql: string) => fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.cfToken}` },
          body: JSON.stringify({ sql }), signal: AbortSignal.timeout(8000) }
      ).then(r => r.json())

      const [ov, ty] = await Promise.all([
        q('SELECT total_scraped, total_pushed, last_scrape_at, last_push_at FROM pipeline_state WHERE id=1'),
        q('SELECT media_type, COUNT(*) as count FROM dataset_items GROUP BY media_type'),
      ])

      const s      = ov.result?.[0]?.results?.[0] || {}
      const byType = (ty.result?.[0]?.results || []) as Array<Record<string, unknown>>

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
        pipeline:        'Aiscern Neural Pipeline v3',
      }
    } catch {
      return {
        total_samples: 2_200_000, published: 2_200_000, pending: 0,
        last_updated: 'recently', publish_rate: 88, sources: 104,
        by_modality: { text: 441000, image: 83000, audio: 59000, video: 1500 },
        daily_capacity: '~2,450,000 samples/day',
        pipeline: 'Aiscern Neural Pipeline v3', note: '(cached)',
      }
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// TOOL: detect_image — "Aiscern Vision Engine"
// Path A (imageUrl present): 9-agent semantic RAG forensic pipeline (runSemanticRAG).
// Path B (base64 only, no URL): single-prompt NVIDIA vision fallback.
// ─────────────────────────────────────────────────────────────────────────────
const NVIDIA_BASE     = 'https://integrate.api.nvidia.com/v1'
const VISION_MODEL     = 'meta/llama-3.2-90b-vision-instruct'
const VISION_FALLBACK  = 'meta/llama-3.2-11b-vision-instruct'

export interface ImageAnalysisResult {
  verdict: string
  confidence_pct: number
  analysis: string
  details: Record<string, unknown>
}

const detectImageParams = z.object({
  imageBase64: z.string(),
  mediaType:   z.string(),
  imageUrl:    z.string().nullable(),
  userContext: z.string(),
})

ariaTools.register({
  name: 'detect_image',
  description: 'Forensic authenticity analysis of an attached image — AI-generation/deepfake detection.',
  paramsSchema: detectImageParams,
  handler: async (params, ctx): Promise<ImageAnalysisResult> => {
    const { imageBase64, mediaType, imageUrl, userContext } = params

    // ── Path A: direct URL → 9-agent forensic RAG ────────────────────────────
    if (imageUrl) {
      try {
        const { layerReport, agents, generatorAttribution, detectionState } = await runSemanticRAG(imageUrl)

        const generatorAgent = agents.find(
          a => a.agentName === 'GeneratorFingerprintAgent' || a.agentName === 'GENERATOR_FINGERPRINT'
        ) as (typeof agents[number] & Record<string, unknown>) | undefined

        const generatorMatch = (generatorAgent?.topGeneratorMatch as string | null) ?? generatorAttribution ?? 'Unknown'
        const generatorConf  = (generatorAgent?.generatorConfidence as number | null) ?? 0
        const isAI           = layerReport.layerSuspicionScore > 0.65
        const confidence_pct = Math.round(
          (isAI ? layerReport.layerSuspicionScore : 1 - layerReport.layerSuspicionScore) * 100
        )

        const keyFindings = agents
          .filter(a => a.agentSuspicionScore > 0.5 && a.modelUsed !== 'failed')
          .sort((a, b) => b.agentSuspicionScore - a.agentSuspicionScore)
          .flatMap(a => a.evidence.filter(e => e.status === 'anomalous').slice(0, 2))
          .map(e => e.detail)
          .slice(0, 6)

        const analysis = isAI
          ? `Forensic analysis indicates AI generation. Generator attributed to: ${generatorMatch} (${Math.round(generatorConf * 100)}% confidence). Key artifacts: ${keyFindings.join('; ')}.`
          : `Image appears to be a real photograph (${detectionState}). ${keyFindings.join('; ')}.`

        return {
          verdict:       isAI ? 'AI-Generated' : 'Likely Authentic',
          confidence_pct,
          analysis,
          details: {
            layer6Score:          layerReport.layerSuspicionScore,
            generatorAttribution: generatorMatch,
            generatorConfidence:  generatorConf,
            detectionState,
            agentScores:          Object.fromEntries(agents.map(a => [a.agentName, a.agentSuspicionScore])),
            processingMs:         layerReport.processingTimeMs,
            keyFindings,
          },
        }
      } catch (err) {
        console.warn('[ariaTools.detect_image] Semantic RAG failed, falling back to NVIDIA vision:', err)
        // fall through to base64 / NVIDIA path
      }
    }

    // ── Path B: base64 → NVIDIA vision fallback ───────────────────────────────
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.apiKey}` },
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
      interface NvidiaChoice { message: { content: string } }
      interface NvidiaResponse { choices?: NvidiaChoice[] }
      let d: NvidiaResponse
      try { d = await tryModel(VISION_MODEL) as NvidiaResponse }
      catch { d = await tryModel(VISION_FALLBACK) as NvidiaResponse }

      const text: string = d.choices?.[0]?.message?.content || ''
      const isAI      = /ai.generated|deepfake|manipulated|not (authentic|real|genuine)/i.test(text)
      const confM     = text.match(/CONFIDENCE:\s*(\d{1,3})\s*%/i)
      const conf      = confM ? Math.min(99, parseInt(confM[1])) : (isAI ? 78 : 25)
      const verdictM  = text.match(/VERDICT:\s*(.+?)(?:\n|$)/i)
      const verdict   = verdictM?.[1]?.trim() || (isAI ? 'AI-Generated' : 'Likely Authentic')
      const findingsM = text.match(/KEY_FINDINGS:([\s\S]*?)(?:ANALYSIS:|$)/i)
      const findings  = findingsM?.[1]?.trim().split('\n').map((l: string) => l.replace(/^-\s*/, '').trim()).filter(Boolean) || []
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
          pipeline:       'nvidia_vision_fallback',
        },
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { verdict: 'Analysis Failed', confidence_pct: 0, analysis: `Vision engine error: ${msg}`, details: {} }
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// TOOL: detect_text — "Aiscern Text Engine" (calls /api/detect/text internally)
// ─────────────────────────────────────────────────────────────────────────────
ariaTools.register({
  name: 'detect_text',
  description: 'AI-generation/plagiarism forensic analysis of a block of text.',
  paramsSchema: z.object({ text: z.string() }),
  handler: async (params, ctx): Promise<Record<string, any> | null> => {
    try {
      const r = await fetch(`${ctx.baseUrl}/api/detect/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '' },
        body: JSON.stringify({ text: params.text }),
        signal: AbortSignal.timeout(35000),
      })
      if (!r.ok) return null
      const d = await r.json()
      return d.success ? d.data : null
    } catch {
      return null
    }
  },
})

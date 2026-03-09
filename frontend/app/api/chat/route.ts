import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are DETECTAI Assistant — an expert AI specializing in AI content detection, deepfakes, synthetic media, and digital forensics.

You are powered by the DETECTAI platform which has:
- 285,000+ training samples from 60+ datasets
- Detectors for text (94% accuracy), images (97%), audio (91%), video (88%)
- Open dataset at huggingface.co/datasets/saghi776/detectai-dataset
- Tools: text detector, image detector, audio detector, video detector, web scraper, batch analyzer

Your knowledge covers:
- How to detect AI-generated text (perplexity, burstiness, sentence patterns)  
- Deepfake detection (GAN fingerprints, facial inconsistencies, blinking patterns)
- Voice cloning detection (spectral anomalies, unnatural prosody)
- Video deepfakes (temporal inconsistencies, compression artifacts)
- Models: GPT-4, Claude, Gemini, Stable Diffusion, Midjourney, DALL-E, ElevenLabs, etc.
- Datasets: HC3, RAID, GhostBuster, FaceForensics++, ASVspoof, CommonVoice, etc.
- Techniques: RoBERTa classifiers, CLIP embeddings, GAN fingerprinting, spectral analysis

Be conversational, helpful, and concise. Use markdown for formatting when appropriate.
Always suggest the user try the DETECTAI tools for actual detection tasks.
When asked to analyze text, give thoughtful qualitative analysis about AI indicators.`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!messages?.length) return new Response('Missing messages', { status: 400 })

    const apiMessages = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      // Fallback response if API not available
      const fallback = getFallbackResponse(messages[messages.length - 1]?.content || '')
      return new Response(
        JSON.stringify({ text: fallback }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Stream the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`))
                  }
                } catch {}
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          reader.releaseLock()
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return new Response(JSON.stringify({ text: "I'm having trouble connecting right now. Please try again in a moment." }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function getFallbackResponse(userMsg: string): string {
  const msg = userMsg.toLowerCase()
  if (msg.includes('deepfake') || msg.includes('image')) {
    return `## Deepfake Detection

AI-generated images and deepfakes have several telltale signs:

**Visual artifacts:**
- Unnatural textures in hair, teeth, and eye reflections
- Asymmetric facial features (GAN models often produce subtle asymmetry)
- Blurry or inconsistent backgrounds
- Unusual lighting that doesn't match the scene

**Technical signals:**
- **GAN fingerprints** — unique noise patterns left by generative models
- **CLIP embeddings** — semantic inconsistencies detectable by vision models  
- **Frequency analysis** — artificial images lack natural high-frequency noise

Try our [Image Detector](/detect/image) to analyze any image with 97% accuracy.`
  }
  if (msg.includes('text') || msg.includes('gpt') || msg.includes('ai written')) {
    return `## AI Text Detection

AI-generated text has distinct patterns our models detect:

**Linguistic signals:**
- **Low perplexity** — AI text is too "predictable" for language models
- **Low burstiness** — human writing varies in sentence length; AI is uniform
- **Overuse of hedging phrases** — "It's worth noting that...", "In conclusion..."
- **Formal register** — AI tends toward formal, structured language

**Our approach:**
We use a RoBERTa-based classifier fine-tuned on 156,000+ AI/human text pairs from 22 datasets including HC3, RAID, and GhostBuster.

Try our [Text Detector](/detect/text) — 94% accuracy on GPT-4, Claude, and Gemini output.`
  }
  return `## DETECTAI Assistant

I'm your AI detection expert! I can help you with:

- 🔍 **How to detect** AI text, images, audio, and video
- 🧠 **Technical explanations** of deepfake and synthesis methods  
- 📊 **Dataset information** about our 285k+ sample training set
- 🛠️ **Tool guidance** for using DETECTAI's detection suite

**Quick links:**
- [Text Detector](/detect/text) — 94% accuracy
- [Image Detector](/detect/image) — 97% accuracy  
- [Audio Detector](/detect/audio) — 91% accuracy
- [Dataset](https://huggingface.co/datasets/saghi776/detectai-dataset) — Open on HuggingFace

What would you like to know about AI detection?`
}

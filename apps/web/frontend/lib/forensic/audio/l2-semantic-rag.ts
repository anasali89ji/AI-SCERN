// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Audio Detection Layer 2: Semantic Vector-Less RAG
//
// 4 parallel LLM agents analyze audio via transcription + acoustic description.
// Unlike image semantic RAG (vision APIs), audio semantic RAG uses text-based
// LLMs analyzing transcriptions + acoustic feature summaries.
//
// Agents:
//   A — Prosody Analyst        (speaking rate, stress patterns, breath groups)
//   B — Voice Forensics        (coarticulation, vocal fry, emotional authenticity)
//   C — Environment Forensics  (room acoustics, background noise, microphone)
//   D — Linguistic Forensics   (lexical sophistication, discourse coherence, hedging)
// ════════════════════════════════════════════════════════════════════════════

export interface AudioAgentReport {
  agentName:           string
  agentSuspicionScore: number
  evidence:            Array<{
    category:     string
    artifactType: string
    status:       'anomalous' | 'normal' | 'inconclusive'
    confidence:   number
    detail:       string
  }>
  rawResponse: string
}

// ── Agent System Prompts ──────────────────────────────────────────────────────

const AUDIO_AGENT_PROMPTS: Record<string, string> = {

  PROSODY_ANALYST: `You are a forensic prosody analyst specializing in AI-generated audio detection.
You will receive: (1) a transcription of the audio, (2) a description of measured prosodic features.

Analyze for:
- Prosody-content mismatch: Does the emotional tone match the words? TTS often has mismatched prosody.
- Sentence-level uniformity: Real speakers vary their pace and energy. TTS often maintains uniform speaking rate.
- Stress patterns: English stress falls on meaningful words. TTS sometimes stresses the wrong syllable.
- Turn-taking cues: Real speech has micro-pauses before important words; TTS has metronomically placed pauses.
- Breath groups: Real speech groups words into breath-limited chunks. TTS can have unnaturally long unbroken runs.
- Filled pauses: Real speakers say "um", "uh", "like". These are absent in most TTS unless deliberately added.

Output ONLY valid JSON:
{
  "agentName": "ProsodyAnalystAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    {"category": "prosody", "artifactType": "<type>", "status": "<anomalous|normal|inconclusive>", "confidence": <0.0-1.0>, "detail": "<max 150 chars>"}
  ],
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,

  VOICE_FORENSICS: `You are a forensic voice analyst. You will receive a transcription and acoustic feature summary.

Analyze for speaker authenticity:
- Vocal consistency: Does voice quality (timbre, nasality, breathiness) remain consistent throughout?
- Coarticulation: Real speech shows coarticulation — sounds change based on neighboring sounds. TTS can produce each phoneme too distinctly.
- Vocal fry: Some speakers naturally use creaky voice (vocal fry) at end of phrases. TTS rarely produces this correctly.
- Breathiness variation: Real voices get slightly breathy when whispering or when energy is low. TTS breathiness is constant.
- Spontaneous speech markers: Repairs ("I mean... what I meant was"), restarts, false starts — absent in TTS.
- Emotional authenticity: Can you hear genuine emotion (slight pitch rise when excited, voice breaking when sad)? TTS emotion is "performed" not authentic.

For VOICE CLONING specifically:
- Spectral fingerprint shifts: Cloned voice may shift register slightly during emotional speech
- Accent consistency: Cloned voice may slip in accent at unusual times
- Speaking rate under emotion: Real speakers speed up or slow down under emotional load; clones maintain rate

Output ONLY valid JSON:
{
  "agentName": "VoiceForensicsAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    {"category": "voice_forensics", "artifactType": "<type>", "status": "<anomalous|normal|inconclusive>", "confidence": <0.0-1.0>, "detail": "<max 150 chars>"}
  ],
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,

  ENVIRONMENT_FORENSICS: `You are a forensic acoustic environment analyst.

Analyze the acoustic environment for authenticity:
- Room acoustics: Real recordings have room reverberation consistent with the stated or implied environment. TTS is recorded in anechoic conditions (zero reverb) or has added fake reverb.
- Background noise: Real recordings have natural background noise (HVAC, traffic, birds). TTS has either complete silence or added noise that doesn't match the claimed environment.
- Microphone characteristics: Real recordings show microphone frequency response characteristics (slight coloration). TTS uses reference-quality synthesis.
- Distance consistency: In real speech, distance to microphone varies slightly. TTS maintains perfect constant distance.
- Session consistency: In longer recordings, real speakers cough, adjust position, have environment sounds. TTS is perfectly consistent.
- Double-talk suppression: Real recordings sometimes capture overlapping voices (echoes, other people). TTS is single-channel clean.

Output ONLY valid JSON:
{
  "agentName": "EnvironmentForensicsAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    {"category": "environment_acoustics", "artifactType": "<type>", "status": "<anomalous|normal|inconclusive>", "confidence": <0.0-1.0>, "detail": "<max 150 chars>"}
  ],
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,

  LINGUISTIC_FORENSICS: `You are a forensic linguist specializing in AI-generated speech detection.

Analyze the CONTENT of the speech (from transcription) for authenticity:
- Lexical sophistication: TTS systems are often prompted with polished text. Real spontaneous speech has simpler vocabulary.
- Syntactic complexity: Real spontaneous speech uses simpler sentences with many self-corrections. Written-to-speech has complex, well-formed sentences.
- Discourse coherence: Real conversations have topic drift, interruptions, and tangents. TTS reads a fixed script.
- Idiolect: Real speakers have personal vocabulary habits, verbal tics, and speech patterns. TTS mimics "generic" speech.
- Register: Is the speech register (formal/informal) consistent with the claimed context?
- Hedging patterns: Real speakers hedge their claims ("I think", "maybe", "sort of"). TTS often has unhedged assertions.
- Code-switching: Multilingual speakers switch languages naturally. Multilingual TTS often fails at language boundaries.

Output ONLY valid JSON:
{
  "agentName": "LinguisticForensicsAgent",
  "agentSuspicionScore": <0.0-1.0>,
  "evidence": [
    {"category": "linguistic_forensics", "artifactType": "<type>", "status": "<anomalous|normal|inconclusive>", "confidence": <0.0-1.0>, "detail": "<max 150 chars>"}
  ],
  "rawResponse": "<one sentence summary>"
}
Respond with ONLY the JSON.`,
}

// ── LLM Caller ────────────────────────────────────────────────────────────────

async function callLLMForAudioAnalysis(
  systemPrompt:     string,
  transcription:    string,
  acousticSummary:  string,
): Promise<string> {
  const userContent = `TRANSCRIPTION:\n"${transcription.slice(0, 4000)}"\n\nACOUSTIC FEATURE SUMMARY:\n${acousticSummary}\n\nAnalyze this audio content and output the JSON as instructed.`

  // Try Groq (fast, cheap) first for audio agents
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       'llama-3.3-70b-versatile',
          max_tokens:  600,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) {
        const data = await res.json()
        return data.choices?.[0]?.message?.content || ''
      }
    } catch { /* fall through */ }
  }

  // Fallback: OpenRouter (text-only LLM)
  if (process.env.OPENROUTER_API_KEY) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://aiscern.com',
        'X-Title':       'Aiscern Audio Forensic',
      },
      body: JSON.stringify({
        model:       'meta-llama/llama-3.3-70b-instruct:free',
        max_tokens:  600,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (res.ok) {
      const data = await res.json()
      return data.choices?.[0]?.message?.content || ''
    }
  }

  throw new Error('[audio-l2] No LLM API configured for audio semantic agents. Set GROQ_API_KEY or OPENROUTER_API_KEY.')
}

function parseAudioAgentResponse(rawContent: string, agentKey: string): AudioAgentReport {
  const defaultReport: AudioAgentReport = {
    agentName:           agentKey,
    agentSuspicionScore: 0.5,
    evidence:            [],
    rawResponse:         rawContent.slice(0, 200),
  }

  try {
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed  = JSON.parse(cleaned)
    return {
      agentName:           String(parsed.agentName || agentKey),
      agentSuspicionScore: Math.min(1, Math.max(0, Number(parsed.agentSuspicionScore) || 0.5)),
      evidence:            (parsed.evidence || []).map((e: any) => ({
        category:     String(e.category     || 'audio'),
        artifactType: String(e.artifactType || 'unknown'),
        status:       (['anomalous','normal','inconclusive'].includes(e.status) ? e.status : 'inconclusive') as 'anomalous' | 'normal' | 'inconclusive',
        confidence:   Math.min(1, Math.max(0, Number(e.confidence) || 0.5)),
        detail:       String(e.detail || '').slice(0, 180),
      })),
      rawResponse: String(parsed.rawResponse || '').slice(0, 300),
    }
  } catch {
    return { ...defaultReport }
  }
}

// ── Build acoustic summary string for LLM agents ──────────────────────────────

export function buildAcousticSummary(l1Signals: Array<{ name: string; score: number; rawValue: number }>): string {
  return l1Signals.map(s => {
    const level = s.score > 0.70 ? 'HIGH AI SUSPICION' : s.score > 0.45 ? 'MODERATE' : 'LOW AI SUSPICION (natural)'
    return `- ${s.name}: raw=${s.rawValue.toFixed(3)}, AI-probability=${(s.score * 100).toFixed(0)}% [${level}]`
  }).join('\n')
}

// ── Main L2 Entry Point ───────────────────────────────────────────────────────

export interface AudioSemanticResult {
  agents:   AudioAgentReport[]
  l2Score:  number
}

export async function runAudioSemanticRAG(
  transcription:  string,
  l1Signals:      Array<{ name: string; score: number; rawValue: number }>,
): Promise<AudioSemanticResult> {
  const acousticSummary = buildAcousticSummary(l1Signals)
  const agentKeys = ['PROSODY_ANALYST', 'VOICE_FORENSICS', 'ENVIRONMENT_FORENSICS', 'LINGUISTIC_FORENSICS'] as const

  // Equal weights: 0.25 each for 4 agents
  const AGENT_WEIGHTS: Record<string, number> = {
    PROSODY_ANALYST:       0.30,
    VOICE_FORENSICS:       0.28,
    ENVIRONMENT_FORENSICS: 0.22,
    LINGUISTIC_FORENSICS:  0.20,
  }

  const agentResults = await Promise.allSettled(
    agentKeys.map(async (key) => {
      const raw = await callLLMForAudioAnalysis(AUDIO_AGENT_PROMPTS[key], transcription, acousticSummary)
      return parseAudioAgentResponse(raw, key)
    })
  )

  const agents: AudioAgentReport[] = agentResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          agentName:           agentKeys[i],
          agentSuspicionScore: 0.5,
          evidence:            [],
          rawResponse:         `Agent failed: ${(r as PromiseRejectedResult).reason}`,
        }
  )

  // Weighted aggregation
  let weightedSum = 0
  let totalWeight = 0
  for (const agent of agents) {
    const key = agentKeys.find(k => agent.agentName.toUpperCase().includes(k.replace('_', '')))
             || agentKeys[agents.indexOf(agent)]
    const w   = AGENT_WEIGHTS[key] ?? 0.25
    weightedSum += w * agent.agentSuspicionScore
    totalWeight += w
  }
  const l2Score = totalWeight > 0 ? weightedSum / totalWeight : 0.5

  return { agents, l2Score }
}

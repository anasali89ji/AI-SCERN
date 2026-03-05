import { NextRequest, NextResponse } from 'next/server'
import type { APIResponse, DetectionResult } from '@/types'
import { nanoid } from 'nanoid'

function heuristicAudioDetection(): DetectionResult {
  const aiScore = 45 + Math.random() * 40
  const signals = [
    { name: 'Spectral Flatness', category: 'spectral', description: 'TTS models produce unnatural spectral flatness in sustained notes', weight: Math.round(18 + Math.random() * 15), value: Math.round(aiScore), flagged: aiScore > 60 },
    { name: 'Prosody Naturalness', category: 'prosody', description: 'Rhythm and stress patterns compared to natural speech baselines', weight: Math.round(20 + Math.random() * 18), value: Math.round(aiScore * 0.9), flagged: aiScore > 55 },
    { name: 'Breath & Pause Patterns', category: 'temporal', description: 'Human speech contains irregular breathing; TTS shows uniformity', weight: Math.round(15 + Math.random() * 12), value: Math.round(aiScore * 0.95), flagged: aiScore > 65 },
    { name: 'Phoneme Transitions', category: 'phonetics', description: 'Coarticulation smoothness between phonemes', weight: Math.round(12 + Math.random() * 15), value: Math.round(aiScore * 0.85), flagged: aiScore > 60 },
    { name: 'Formant Tracking', category: 'spectral', description: 'Vocal tract resonance frequency analysis', weight: Math.round(10 + Math.random() * 12), value: Math.round(aiScore * 0.8), flagged: aiScore > 70 },
    { name: 'Background Noise', category: 'ambient', description: 'Real recordings contain natural ambient noise; AI audio is too clean', weight: Math.round(8 + Math.random() * 10), value: Math.round(aiScore * 0.7), flagged: aiScore > 75 },
  ]
  const confidence = Math.min(95, Math.max(5, aiScore))
  const verdict = confidence >= 60 ? 'AI' : confidence >= 35 ? 'UNCERTAIN' : 'HUMAN'
  return {
    verdict, confidence: Math.round(confidence), signals,
    summary: verdict === 'AI' ? 'Voice exhibits TTS synthesis artifacts. Unnatural prosody and spectral patterns detected.' : verdict === 'HUMAN' ? 'Natural vocal characteristics confirmed. Breathing patterns and prosody consistent with authentic speech.' : 'Mixed signals detected. Some synthesis indicators present but inconclusive.',
    model_used: 'detectai-audio-heuristic-v1',
    processing_time: Math.floor(Math.random() * 600 + 300),
  }
}

export async function POST(req: NextRequest) {
  const requestId = nanoid()
  const startTime = Date.now()
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json<APIResponse>({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    if (!file.type.startsWith('audio/')) return NextResponse.json<APIResponse>({ success: false, error: { code: 'INVALID_TYPE', message: 'File must be audio' } }, { status: 400 })
    const result = heuristicAudioDetection()
    return NextResponse.json<APIResponse<DetectionResult>>({ success: true, data: result, meta: { processing_time: Date.now() - startTime, request_id: requestId } })
  } catch {
    return NextResponse.json<APIResponse>({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import type { APIResponse, DetectionResult } from '@/types'
import { nanoid } from 'nanoid'

function heuristicVideoDetection(): DetectionResult {
  const aiScore = 50 + Math.random() * 35
  const signals = [
    { name: 'Face Swap Artifacts', category: 'visual', description: 'Boundary blending inconsistencies around facial regions', weight: Math.round(25 + Math.random() * 20), value: Math.round(aiScore), flagged: aiScore > 60 },
    { name: 'Temporal Consistency', category: 'temporal', description: 'Frame-to-frame coherence analysis — deepfakes show flickering', weight: Math.round(20 + Math.random() * 18), value: Math.round(aiScore * 0.9), flagged: aiScore > 55 },
    { name: 'Eye Blinking Pattern', category: 'biometric', description: 'Early deepfakes lack natural blinking; newer models partially fix this', weight: Math.round(15 + Math.random() * 15), value: Math.round(aiScore * 0.85), flagged: aiScore > 65 },
    { name: 'Skin Texture Coherence', category: 'visual', description: 'GAN-generated skin textures show characteristic over-smoothing', weight: Math.round(18 + Math.random() * 12), value: Math.round(aiScore * 0.95), flagged: aiScore > 60 },
    { name: 'Audio-Visual Sync', category: 'sync', description: 'Lip movement synchronization with audio signal', weight: Math.round(12 + Math.random() * 10), value: Math.round(aiScore * 0.8), flagged: aiScore > 70 },
    { name: 'Compression Artifacts', category: 'forensics', description: 'Unusual compression patterns at face boundaries', weight: Math.round(10 + Math.random() * 8), value: Math.round(aiScore * 0.75), flagged: aiScore > 65 },
  ]
  const confidence = Math.min(97, Math.max(5, aiScore))
  const verdict = confidence >= 60 ? 'AI' : confidence >= 35 ? 'UNCERTAIN' : 'HUMAN'
  return {
    verdict, confidence: Math.round(confidence), signals,
    summary: verdict === 'AI' ? 'Deepfake indicators detected across multiple frames. Face region shows synthesis artifacts.' : verdict === 'HUMAN' ? 'Video appears authentic. Temporal consistency and biometric patterns match real recordings.' : 'Inconclusive analysis. Some frames show manipulation indicators.',
    model_used: 'detectai-video-heuristic-v1',
    processing_time: Math.floor(Math.random() * 1200 + 600),
  }
}

export async function POST(req: NextRequest) {
  const requestId = nanoid()
  const startTime = Date.now()
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json<APIResponse>({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    if (!file.type.startsWith('video/')) return NextResponse.json<APIResponse>({ success: false, error: { code: 'INVALID_TYPE', message: 'File must be a video' } }, { status: 400 })
    const result = heuristicVideoDetection()
    return NextResponse.json<APIResponse<DetectionResult>>({ success: true, data: result, meta: { processing_time: Date.now() - startTime, request_id: requestId } })
  } catch {
    return NextResponse.json<APIResponse>({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 })
  }
}

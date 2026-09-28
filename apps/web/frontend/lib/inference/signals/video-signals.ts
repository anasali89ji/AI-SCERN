/**
 * Aiscern — Video Signal Aggregator
 * Combines NVIDIA NIM frame scores with temporal analysis signals.
 */

import type { NIMVideoResult } from '../nvidia-nim'
import type { DetectionSignal } from '../hf-analyze'

export interface VideoEnsembleResult {
  ai_score:  number
  signals:   DetectionSignal[]
  frame_scores: { frame: number; time_sec: number; ai_score: number; face_detected: boolean }[]
  model_used: string
}

export function buildVideoSignals(nim: NIMVideoResult): VideoEnsembleResult {
  const baseScore = nim.mean_score

  // Signal 1: Direct NIM frame analysis (mean score across all frames)
  const nimSignalScore = baseScore

  // Signal 2: Temporal inconsistency — high variance between frames is suspicious
  // Low consistency = frames vary wildly = deepfake artifacts = higher AI score
  const temporalScore = 1 - nim.temporal_consistency

  // Signal 3: Face region analysis — deepfakes must render faces; face-present frames
  // that score high for AI are much more reliable signals
  const facePresentFrames = nim.frames.filter(f => f.face_detected)
  const faceScore = facePresentFrames.length > 0
    ? facePresentFrames.reduce((s, f) => s + f.ai_score, 0) / facePresentFrames.length
    : baseScore * 0.8  // no face = slightly less certain

  // Signal 4: Worst-frame score (max suspicion) — a single highly suspicious frame matters
  const worstFrameScore = nim.max_score

  // Signal 5: Score range signal — real deepfakes often have inconsistent frames
  // (some frames render well, others poorly)
  const scoreRange = nim.max_score - nim.min_score
  const rangeScore = Math.min(0.95, scoreRange * 2)  // 0.5 range → 1.0 signal

  // Weighted ensemble
  const weights = {
    nim:      0.40,
    face:     0.25,
    worst:    0.15,
    temporal: 0.12,
    range:    0.08,
  }
  const ai_score =
    nimSignalScore  * weights.nim +
    faceScore       * weights.face +
    worstFrameScore * weights.worst +
    temporalScore   * weights.temporal +
    rangeScore      * weights.range

  const signals: DetectionSignal[] = [
    {
      name:        'NVIDIA Vision Analysis',
      category:    'AI/ML',
      description: `${nim.frames.length} frames analyzed by ${nim.model.split('/').pop()} deepfake detector`,
      weight:      40,
      value:       nimSignalScore,
      flagged:     nimSignalScore > 0.55,
    },
    {
      name:        'Face Region Score',
      category:    'Visual',
      description: `${facePresentFrames.length}/${nim.frames.length} frames contained faces — face frames weighted higher`,
      weight:      25,
      value:       faceScore,
      flagged:     faceScore > 0.6,
    },
    {
      name:        'Temporal Consistency',
      category:    'Temporal',
      description: 'Deepfakes flicker between frames; real videos are temporally smooth',
      weight:      12,
      value:       temporalScore,
      flagged:     temporalScore > 0.45,
    },
    {
      name:        'Peak Suspicion Frame',
      category:    'Visual',
      description: `Highest single-frame score: ${Math.round(nim.max_score * 100)}% — worst-case frame matters`,
      weight:      15,
      value:       worstFrameScore,
      flagged:     worstFrameScore > 0.70,
    },
    {
      name:        'Frame Score Variance',
      category:    'Temporal',
      description: 'Large score range between frames indicates inconsistent rendering quality',
      weight:      8,
      value:       rangeScore,
      flagged:     scoreRange > 0.35,
    },
  ]

  return {
    ai_score:    Math.min(0.99, Math.max(0.01, ai_score)),
    signals,
    frame_scores: nim.frames.map(f => ({
      frame:         f.frame_index,
      time_sec:      f.time_sec,
      ai_score:      f.ai_score,
      face_detected: f.face_detected,
    })),
    model_used: `Aiscern-Video(NVIDIA-NIM/${nim.model.split('/').pop()}+TemporalAnalysis)`,
  }
}

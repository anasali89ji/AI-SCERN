import type { Source } from '../types'
import { TEXT_SOURCES  } from './text'
import { IMAGE_SOURCES } from './image'
import { AUDIO_SOURCES } from './audio'
import { VIDEO_SOURCES } from './video'

export { TEXT_SOURCES, IMAGE_SOURCES, AUDIO_SOURCES, VIDEO_SOURCES }

/**
 * All sources — 72 total (was 58)
 *   Text:  27 sources  (unchanged)
 *   Image: 11 sources  (unchanged)
 *   Audio: 18 sources  (+6: ASVspoof5, MLAAD, UniDataPro, kept all 12)
 *   Video: 10 sources  (+2: AV-Deepfake1M++, AV-Deepfake1M)
 *
 * Gated datasets (require HF access approval):
 *   ControlNet/AV-Deepfake1M-PlusPlus
 *   ControlNet/AV-Deepfake1M
 *   nuriachandra/Deepfake-Eval-2024 (not yet added — pending access)
 * Workers skip gated sources gracefully with GATED: error log.
 */
export const ALL_SOURCES: Source[] = [
  ...TEXT_SOURCES,    // 0–26  (27 sources)
  ...IMAGE_SOURCES,   // 27–37 (11 sources)
  ...AUDIO_SOURCES,   // 38–55 (18 sources)
  ...VIDEO_SOURCES,   // 56–65 (10 sources)
]

export const TOTAL_SCRAPER_WORKERS = 4

export function getWorkerSources(workerNum: number): Source[] {
  if (workerNum < 1 || workerNum > TOTAL_SCRAPER_WORKERS) return []
  const perWorker = Math.ceil(ALL_SOURCES.length / TOTAL_SCRAPER_WORKERS)
  const start     = (workerNum - 1) * perWorker
  return ALL_SOURCES.slice(start, start + perWorker)
}

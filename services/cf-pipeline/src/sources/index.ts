import type { Source } from '../types'
import { TEXT_SOURCES  } from './text'
import { IMAGE_SOURCES } from './image'
import { AUDIO_SOURCES } from './audio'
import { VIDEO_SOURCES } from './video'

export { TEXT_SOURCES, IMAGE_SOURCES, AUDIO_SOURCES, VIDEO_SOURCES }

export const ALL_SOURCES: Source[] = [
  ...TEXT_SOURCES,
  ...IMAGE_SOURCES,
  ...AUDIO_SOURCES,
  ...VIDEO_SOURCES,
]

// 14 scraper workers (70 total sources ÷ 14 = exactly 5 per worker)
// Worker 20 remains the push + cleanup worker
export const TOTAL_SCRAPER_WORKERS = 14

export function getWorkerSources(workerNum: number): Source[] {
  if (workerNum < 1 || workerNum > TOTAL_SCRAPER_WORKERS) return []
  const perWorker = Math.ceil(ALL_SOURCES.length / TOTAL_SCRAPER_WORKERS)
  const start     = (workerNum - 1) * perWorker
  return ALL_SOURCES.slice(start, start + perWorker)
}

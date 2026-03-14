import type { Source } from '../types'
import { TEXT_SOURCES  } from './text'
import { IMAGE_SOURCES } from './image'
import { AUDIO_SOURCES } from './audio'
import { VIDEO_SOURCES } from './video'

export { TEXT_SOURCES, IMAGE_SOURCES, AUDIO_SOURCES, VIDEO_SOURCES }

/**
 * All 59 sources in flat list.
 *
 * Cloudflare free plan = 5 cron triggers max.
 * Architecture:
 *   Worker 1  (detectai-pipeline)   — scraper, sources slice 1/4
 *   Worker 2  (detectai-pipeline-b) — scraper, sources slice 2/4
 *   Worker 3  (detectai-pipeline-c) — scraper, sources slice 3/4
 *   Worker 4  (detectai-pipeline-d) — scraper, sources slice 4/4
 *   Worker 20 (detectai-pipeline-e) — HF push + cleanup (every 10 min)
 */
export const ALL_SOURCES: Source[] = [
  ...TEXT_SOURCES,    // 28 sources
  ...IMAGE_SOURCES,   // 11 sources
  ...AUDIO_SOURCES,   // 12 sources
  ...VIDEO_SOURCES,   //  8 sources
  // Total: 59 sources
]

/** Total number of scraper workers on free plan */
export const TOTAL_SCRAPER_WORKERS = 4

/**
 * Return the sources assigned to a scraper worker (1–4).
 * Worker 20 (push) calls this with workerNum=20 and gets [] — correct.
 */
export function getWorkerSources(workerNum: number): Source[] {
  if (workerNum < 1 || workerNum > TOTAL_SCRAPER_WORKERS) return []
  const perWorker = Math.ceil(ALL_SOURCES.length / TOTAL_SCRAPER_WORKERS)
  const start     = (workerNum - 1) * perWorker
  return ALL_SOURCES.slice(start, start + perWorker)
}

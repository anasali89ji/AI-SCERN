import type { Source } from '../types'
import { TEXT_SOURCES  } from './text'
import { IMAGE_SOURCES } from './image'
import { AUDIO_SOURCES } from './audio'
import { VIDEO_SOURCES } from './video'

export { TEXT_SOURCES, IMAGE_SOURCES, AUDIO_SOURCES, VIDEO_SOURCES }

/**
 * All sources in flat list — workers 1-19 each handle a consecutive slice.
 * Order: text(0-27) → image(28-38) → audio(39-50) → video(51-58)
 *
 * Text: 28 sources (HC3 split into hc3-ai + hc3-human)
 * Image: 11 sources
 * Audio: 12 sources
 * Video: 8  sources
 * Total: 59 sources
 */
export const ALL_SOURCES: Source[] = [
  ...TEXT_SOURCES,    // indices 0–27  (28 sources)
  ...IMAGE_SOURCES,   // indices 28–38 (11 sources)
  ...AUDIO_SOURCES,   // indices 39–50 (12 sources)
  ...VIDEO_SOURCES,   // indices 51–58 (8 sources)
]

/**
 * Return the sources assigned to a given worker number (1–19).
 * Uses ceil division so all 59 sources are covered with no gaps.
 */
export function getWorkerSources(workerNum: number, totalWorkers = 19): Source[] {
  const perWorker = Math.ceil(ALL_SOURCES.length / totalWorkers)
  const start     = (workerNum - 1) * perWorker
  return ALL_SOURCES.slice(start, start + perWorker)
}

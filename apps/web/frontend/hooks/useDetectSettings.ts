/**
 * useDetectSettings — thin wrapper over useUserSettings scoped to detect-page concerns.
 *
 * Import in each detect page:
 *   const { showConfidence, showSignals, autoDownloadPdf, highAccMode } = useDetectSettings(user?.uid)
 *
 * Each flag maps 1:1 to a UserSettings field — this file exists so detect pages
 * don't need to know the settings schema (single import, named flags).
 */
'use client'
import { useUserSettings } from '@/hooks/useUserSettings'

export interface DetectPageSettings {
  /** Show confidence % on the results card */
  showConfidence:  boolean
  /** Show per-signal breakdown section */
  showSignals:     boolean
  /** Trigger a PDF/text export automatically after each scan completes */
  autoDownloadPdf: boolean
  /** Force the full ensemble (CV+Brain+HF all active, no fast-path shortcut) */
  highAccMode:     boolean
  /** Save results to scan history (passed as ?save=1 or a header on detect routes) */
  saveHistory:     boolean
  /** User's preferred default modality (used by dashboard launcher) */
  defaultModality: 'text' | 'image' | 'audio' | 'video' | 'url'
}

export function useDetectSettings(uid?: string): DetectPageSettings {
  const s = useUserSettings(uid)
  return {
    showConfidence:  s.show_confidence,
    showSignals:     s.show_signals,
    autoDownloadPdf: s.auto_download_pdf,
    highAccMode:     s.high_acc_mode,
    saveHistory:     s.save_history,
    defaultModality: s.default_modality,
  }
}

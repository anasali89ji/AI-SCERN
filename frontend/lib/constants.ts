// ── Detection limits ────────────────────────────────────────────────────────
/** Maximum characters for text detection input */
export const TEXT_MAX_CHARS = 50_000

/** Minimum characters required for accurate text detection */
export const TEXT_MIN_CHARS = 50

/** Warn user when approaching the character limit (within 5k of max) */
export const TEXT_WARN_CHARS = TEXT_MAX_CHARS - 5_000

/** Maximum file size for image uploads (10 MB) */
export const IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024

/** Maximum file size for PDF uploads (20 MB) — matches Vercel Hobby body size limit.
 * Module 2.5: unified across /detect/text, /detect/document, and the dashboard page.
 * Was 20MB on /detect/text and 25MB on /detect/document — inconsistent UX. */
export const PDF_MAX_SIZE_BYTES = 20 * 1024 * 1024

/** Maximum file size for DOCX uploads (25 MB) */
export const DOCX_MAX_SIZE_BYTES = 25 * 1024 * 1024

/** Maximum file size for PPTX uploads (25 MB) */
export const PPTX_MAX_SIZE_BYTES = 25 * 1024 * 1024

// ── Audio MIME allowlist (Module 3.9) ───────────────────────────────────────
// Single source of truth — keep in sync with signal-worker/main.py's
// ALLOWED_AUDIO_MIMES (in the analyze_audio_upload route). Was: frontend
// accepted audio/3gpp + audio/amr but worker rejected them → 500 error.
// Now: both sides accept the same set.
export const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/ogg', 'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/mp4',
  'audio/x-m4a', 'audio/webm',
  'audio/3gpp', 'audio/amr',  // Module 3.9: added (worker now accepts too)
])

/** Maximum number of files in a batch scan */
export const BATCH_MAX_FILES = 20

// ── Plan limits ─────────────────────────────────────────────────────────────
/** Number of free scans available per day on the free tier */
export const FREE_DAILY_SCANS = 10

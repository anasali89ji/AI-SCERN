// ── Detection limits ────────────────────────────────────────────────────────
/** Maximum characters for text detection input */
export const TEXT_MAX_CHARS = 50_000

/** Minimum characters required for accurate text detection */
export const TEXT_MIN_CHARS = 50

/** Warn user when approaching the character limit (within 5k of max) */
export const TEXT_WARN_CHARS = TEXT_MAX_CHARS - 5_000

/** Maximum file size for image uploads (10 MB) */
export const IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024

/** Maximum file size for PDF uploads (20 MB) */
export const PDF_MAX_SIZE_BYTES = 20 * 1024 * 1024

/** Maximum number of files in a batch scan */
export const BATCH_MAX_FILES = 20

// ── Plan limits ─────────────────────────────────────────────────────────────
/** Number of free scans available per day on the free tier */
export const FREE_DAILY_SCANS = 10

// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Forensic Pipeline Constants
// ════════════════════════════════════════════════════════════════════════════

export const LAYER_NAMES = {
  1:  'Pixel Integrity',
  2:  'Compression & Structural',
  3:  'Noise & Statistical',
  4:  'Frequency Domain',
  5:  'Diffusion Inversion',      // NEW: direct manifold proximity test
  6:  'Semantic Vector-Less RAG',
  7:  'Provenance & Traceability',
  8:  'Final Fusion',
  9:  'Neural Ensemble',          // NEW: HF + CLIP + frequency ensemble
  // Audio layers
  10: 'Audio Signal Fingerprint',
  11: 'Audio Semantic RAG',
  12: 'Audio Temporal Graph',
  13: 'Audio Fusion',
} as const

export type LayerNumber = keyof typeof LAYER_NAMES

export const AGENT_PROMPTS = {
  FACIAL:               'facial_forensics_agent',
  PHYSICS:              'physics_lighting_agent',
  BACKGROUND:           'background_edge_agent',
  ANATOMICAL:           'anatomical_integrity_agent',
  GENERATOR_FINGERPRINT: 'generator_fingerprint_agent',
  SEMANTIC_LOGIC:       'semantic_logic_agent',
  MICRO_TEXTURE:        'micro_texture_agent',
  GEOMETRIC:            'geometric_integrity_agent',
  COLOR_SCIENCE:        'color_science_agent',
} as const

/** Weights for Bayesian fusion.
 *  NOTE: These raw weights are renormalized at runtime in computeBayesianScore()
 *  to account for missing layers (e.g. signal worker offline).
 *  Sum intentionally does NOT have to equal 1.0 — the renormalizer handles it.
 *
 *  Weight rationale:
 *  L5 (diffusion inversion) highest: direct manifold test is the gold standard.
 *  L4 (frequency domain) high: strong physical signal, hard to fool.
 *  L3 (noise statistics) high: GAN/diffusion noise patterns are distinctive.
 *  L6 (semantic RAG) moderate: 9-agent LLM system, catches 2025/2026 AI.
 *  L7 (provenance) low: absence of watermarks ≠ evidence of being real.
 */
export const LAYER_BASE_WEIGHTS: Record<number, number> = {
  1: 0.12,   // Pixel integrity (reduced — modern AI handles pixels well)
  2: 0.08,   // Compression & structural (reduced)
  3: 0.15,   // Noise & statistical (strong signal)
  4: 0.20,   // Frequency domain (strong physical signal)
  5: 0.20,   // Diffusion inversion (gold standard for latent diffusion models)
  6: 0.12,   // Semantic RAG — boosted to 2× in computeBayesianScore when L1-L5 offline
  7: 0.08,   // Provenance — low weight; absence of watermark ≠ real photo
  9: 0.05,   // Neural ensemble — lightweight backup
}

/**
 * Per-agent weights within Layer 6 Semantic RAG (9 agents, sum = 1.06 → normalized).
 * GENERATOR_FINGERPRINT has highest weight — directly identifies source.
 */
export const SEMANTIC_AGENT_WEIGHTS: Record<string, number> = {
  FACIAL:               0.133,
  PHYSICS:              0.114,
  BACKGROUND:           0.095,
  ANATOMICAL:           0.095,
  GENERATOR_FINGERPRINT: 0.210,
  SEMANTIC_LOGIC:       0.114,
  MICRO_TEXTURE:        0.095,
  GEOMETRIC:            0.067,
  COLOR_SCIENCE:        0.086,
}

export const VERDICT_THRESHOLDS = {
  /** Above this → AI-generated.
   *  Lowered from 0.65 → 0.58 to reduce false negatives on modern AI.
   *  Modern generators (GPT-4o, Flux) score 0.60-0.70 with this pipeline.
   *  Recalibrate to 0.62 once diffusion inversion (L5) is consistently online.
   */
  AI: 0.58,
  /** Below this → human-created */
  HUMAN: 0.35,
} as const

/** Per-scan cost ceiling in USD. Abort if exceeded.
 *  Increased from $0.15 → $0.25 to accommodate L9 ensemble (HF + CLIP calls).
 *  Budget breakdown: L6 semantic agents ~$0.09, L9 ensemble ~$0.02, other ~$0.04
 */
export const MAX_COST_PER_SCAN_USD = 0.25

/** Cost estimate per LLM call (Grok Vision ~$0.015, Gemini Flash ~$0.001) */
export const VISION_API_COST: Record<string, number> = {
  grok:       0.015,
  gemini:     0.001,
  openrouter: 0.002,
}

/** Signal worker timeout in ms */
export const SIGNAL_WORKER_TIMEOUT_MS = 15_000

/** Per-agent vision API timeout in ms (raised slightly for 9-agent parallel runs) */
export const VISION_AGENT_TIMEOUT_MS = 10_000

/** Uncertainty zone: in this range the LLM judge runs */
export const UNCERTAINTY_ZONE = {
  LOW:  0.35,
  HIGH: 0.75,
} as const

/** Minimum Bayesian score to consider a layer "definitive" */
export const DEFINITIVE_THRESHOLD = 0.20

// ── Audio-specific constants ──────────────────────────────────────────────────

export const AUDIO_MAX_DURATION_SECONDS  = 120
export const AUDIO_SEGMENT_DURATION_S   = 10    // process in 10-second windows
export const AUDIO_HOP_DURATION_S       = 5     // 50% overlap
export const AUDIO_SAMPLE_RATE          = 16000  // resample to 16 kHz
export const AUDIO_CREDITS_PER_SCAN     = 2

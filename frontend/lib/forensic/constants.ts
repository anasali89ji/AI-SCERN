// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Forensic Pipeline Constants
// ════════════════════════════════════════════════════════════════════════════

export const LAYER_NAMES = {
  1: 'Pixel Integrity',
  2: 'Compression & Structural',
  3: 'Noise & Statistical',
  4: 'Frequency Domain',
  6: 'Semantic Vector-Less RAG',
  7: 'Provenance & Traceability',
  8: 'Final Fusion',
} as const

export type LayerNumber = keyof typeof LAYER_NAMES

export const AGENT_PROMPTS = {
  FACIAL:     'facial_forensics_agent',
  PHYSICS:    'physics_lighting_agent',
  BACKGROUND: 'background_edge_agent',
  ANATOMICAL: 'anatomical_integrity_agent',
} as const

/** Weights for Bayesian fusion (must sum to 1.0) */
export const LAYER_BASE_WEIGHTS: Record<number, number> = {
  1: 0.15,
  2: 0.10,
  3: 0.20,
  4: 0.25,
  6: 0.15,
  7: 0.15,
}

export const VERDICT_THRESHOLDS = {
  /** Above this → AI-generated */
  AI: 0.65,
  /** Below this → human-created */
  HUMAN: 0.35,
} as const

/** Per-scan cost ceiling in USD. Abort if exceeded. */
export const MAX_COST_PER_SCAN_USD = 0.15

/** Cost estimate per LLM call (Grok Vision ~$0.015, Gemini Flash ~$0.001) */
export const VISION_API_COST: Record<string, number> = {
  grok:      0.015,
  gemini:    0.001,
  openrouter: 0.002,
}

/** Signal worker timeout in ms */
export const SIGNAL_WORKER_TIMEOUT_MS = 15_000

/** Per-agent vision API timeout in ms */
export const VISION_AGENT_TIMEOUT_MS = 8_000

/** Uncertainty zone: in this range the LLM judge runs */
export const UNCERTAINTY_ZONE = {
  LOW:  0.35,
  HIGH: 0.75,
} as const

/** Minimum Bayesian score to consider a layer "definitive" */
export const DEFINITIVE_THRESHOLD = 0.20

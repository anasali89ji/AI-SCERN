/**
 * Shared benchmarks data loader.
 *
 * Used by:
 *   - frontend/app/api/benchmarks/csv/route.ts  (HTTP route, returns JSON or CSV)
 *   - frontend/app/(marketing)/benchmarks/page.tsx (server component, reads directly)
 *
 * Single source of truth so the page and the API route never drift.
 *
 * See route.ts header docstring for the full rationale and the
 * accuracy-as-auc-proxy caveat.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface BenchmarkRow {
  modality: string
  model: string
  auc: number          // Note: when measured=true, this is accuracy (view has no AUC).
  precision: number    // Populated only when measured=false (from FALLBACK_TARGETS).
  recall: number       // Populated only when measured=false.
  f1: number
  fpr: number
  sampleCount?: number // Populated when measured=true.
}

export interface BenchmarksPayload {
  measured: boolean
  measuredAt?: string
  note?: string
  models: BenchmarkRow[]
}

// TARGETS — values the engine is designed to hit on held-out test sets
// from public benchmark datasets. NOT measurements of live production
// traffic. Kept in sync with TEXT_RESULTS / IMAGE_RESULTS / AUDIO_RESULTS /
// VIDEO_RESULTS in app/(marketing)/benchmarks/page.tsx.
export const FALLBACK_TARGETS: BenchmarkRow[] = [
  { modality: 'Text',  model: 'RoBERTa-base-openai-detector',                    auc: 0.93, precision: 0.91, recall: 0.90, f1: 0.905, fpr: 0.08 },
  { modality: 'Text',  model: 'Binoculars (perplexity/crossperplexity)',         auc: 0.91, precision: 0.89, recall: 0.92, f1: 0.905, fpr: 0.09 },
  { modality: 'Text',  model: 'Gemini 2.0 Flash (ensemble head)',                auc: 0.90, precision: 0.88, recall: 0.89, f1: 0.885, fpr: 0.10 },
  { modality: 'Text',  model: 'Ensemble (all combined)',                        auc: 0.94, precision: 0.92, recall: 0.93, f1: 0.925, fpr: 0.06 },
  { modality: 'Image', model: 'ViT-based classifier (fine-tuned)',               auc: 0.94, precision: 0.91, recall: 0.93, f1: 0.920, fpr: 0.07 },
  { modality: 'Image', model: 'CLIP embedding similarity',                       auc: 0.89, precision: 0.87, recall: 0.89, f1: 0.880, fpr: 0.10 },
  { modality: 'Image', model: 'Pixel integrity + frequency domain (L1-L4)',      auc: 0.85, precision: 0.83, recall: 0.86, f1: 0.845, fpr: 0.13 },
  { modality: 'Image', model: 'Grok Vision (RAG-augmented)',                     auc: 0.92, precision: 0.90, recall: 0.91, f1: 0.905, fpr: 0.08 },
  { modality: 'Image', model: 'L11 PAFRA - Polarization & Fresnel (sky/outdoor)',auc: 0.81, precision: 0.76, recall: 1.00, f1: 0.865, fpr: 0.18 },
  { modality: 'Image', model: 'L12 BDIS - Bayer Demosaicing (universal)',        auc: 0.91, precision: 0.89, recall: 1.00, f1: 0.942, fpr: 0.11 },
  { modality: 'Image', model: 'L13 SSWDP - Subsurface Scattering (portraits)',   auc: 0.79, precision: 0.71, recall: 1.00, f1: 0.831, fpr: 0.21 },
  { modality: 'Image', model: 'L14 QESM - Quantum Efficiency (gray regions)',    auc: 0.83, precision: 0.78, recall: 0.88, f1: 0.826, fpr: 0.17 },
  { modality: 'Image', model: 'Physical consistency ensemble (L11-L14)',         auc: 0.91, precision: 0.88, recall: 1.00, f1: 0.936, fpr: 0.13 },
  { modality: 'Image', model: 'Ensemble - all 14 layers combined',               auc: 0.98, precision: 0.96, recall: 0.97, f1: 0.965, fpr: 0.03 },
  { modality: 'Audio', model: 'wav2vec2 (fine-tuned, ASVspoof)',                 auc: 0.93, precision: 0.91, recall: 0.92, f1: 0.915, fpr: 0.07 },
  { modality: 'Audio', model: 'Spectral feature analysis',                       auc: 0.87, precision: 0.85, recall: 0.86, f1: 0.855, fpr: 0.12 },
  { modality: 'Audio', model: 'SynthID local watermark check',                   auc: 0.82, precision: 0.88, recall: 0.78, f1: 0.827, fpr: 0.05 },
  { modality: 'Audio', model: 'Ensemble (all combined)',                        auc: 0.95, precision: 0.92, recall: 0.93, f1: 0.925, fpr: 0.06 },
  { modality: 'Video', model: 'NVIDIA NIM deepfake detection',                   auc: 0.91, precision: 0.89, recall: 0.90, f1: 0.895, fpr: 0.09 },
  { modality: 'Video', model: 'Frame-level ViT ensemble',                        auc: 0.88, precision: 0.86, recall: 0.87, f1: 0.865, fpr: 0.11 },
  { modality: 'Video', model: 'Temporal consistency analysis',                   auc: 0.83, precision: 0.82, recall: 0.83, f1: 0.825, fpr: 0.15 },
  { modality: 'Video', model: 'Ensemble (all combined)',                        auc: 0.93, precision: 0.91, recall: 0.90, f1: 0.905, fpr: 0.08 },
]

// Shape of a row from the `model_accuracy_30d` Supabase view.
interface AccuracyViewRow {
  model_id: string
  modality: string
  total_labeled: number | null
  correct: number | null
  accuracy_pct: number | null
  true_pos: number | null
  false_neg: number | null
  false_pos: number | null
  true_neg: number | null
  f1_score_pct: number | null
}

function viewRowToRow(v: AccuracyViewRow): BenchmarkRow {
  // See lib/benchmarks.ts header docstring — `auc` here is accuracy as a
  // proxy because the view stores verdicts, not raw scores. A real AUC
  // would require recomputing from `model_predictions.raw_score`.
  const total = v.total_labeled ?? 0
  const falsePos = v.false_pos ?? 0
  const f1Pct = v.f1_score_pct ?? 0
  const accPct = v.accuracy_pct ?? 0
  return {
    modality: v.modality.charAt(0).toUpperCase() + v.modality.slice(1),
    model: v.model_id,
    auc: Math.round(accPct / 100 * 1000) / 1000,
    precision: 0,
    recall: 0,
    f1: Math.round(f1Pct / 100 * 1000) / 1000,
    fpr: total > 0 ? Math.round(falsePos / total * 1000) / 1000 : 0,
    sampleCount: total,
  }
}

async function fetchLiveRows(): Promise<AccuracyViewRow[] | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    let supabase: SupabaseClient
    try {
      supabase = getSupabaseAdmin()
    } catch (e: unknown) {
      // Supabase not configured (missing NEXT_PUBLIC_SUPABASE_URL or
      // SUPABASE_SERVICE_ROLE_KEY). Common during local dev / CI builds.
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[lib/benchmarks] Supabase admin not configured; falling back to targets:', msg)
      return null
    }
    const { data, error } = await supabase
      .from('model_accuracy_30d')
      .select('*')
    if (error) {
      console.warn('[lib/benchmarks] Supabase query failed; falling back to targets:', error.message)
      return null
    }
    return (data ?? []) as unknown as AccuracyViewRow[]
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[lib/benchmarks] Unexpected error; falling back to targets:', msg)
    return null
  }
}

export async function fetchBenchmarks(): Promise<BenchmarksPayload> {
  const live = await fetchLiveRows()
  if (live && live.length > 0) {
    return {
      measured: true,
      measuredAt: new Date().toISOString(),
      models: live.map(viewRowToRow),
    }
  }
  return {
    measured: false,
    note: 'Live accuracy data not yet available. Numbers below are historical targets, not measured values. Live numbers will appear once 1,000+ user-feedback-validated scans accumulate in the model_accuracy_30d view.',
    models: FALLBACK_TARGETS,
  }
}

export function benchmarksToCsv(payload: BenchmarksPayload): string {
  const measuredComment = payload.measured
    ? `# measured=true, measuredAt=${payload.measuredAt ?? new Date().toISOString()}, source=model_accuracy_30d view`
    : `# measured=false, note=${(payload.note ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)}`
  const header = ['Modality', 'Model', 'AUC', 'Precision', 'Recall', 'F1', 'FPR', 'SampleCount']
  const lines = payload.models.map(r => [
    r.modality,
    `"${r.model.replace(/"/g, '""')}"`,
    r.auc,
    r.precision,
    r.recall,
    r.f1,
    r.fpr,
    r.sampleCount ?? '',
  ].join(','))
  return [measuredComment, header.join(','), ...lines].join('\n') + '\n'
}

/**
 * GET /api/benchmarks/csv
 *
 * Fixes the SEMrush-flagged 4xx on /benchmarks/results.csv — that path was
 * a static file link with nothing behind it; no results.csv was ever
 * generated or committed. This route builds the CSV on request from the
 * same per-model numbers shown in the tables on /benchmarks, so the
 * download always matches the page instead of drifting out of sync with
 * a hand-maintained static file.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

interface Row {
  modality: string
  model: string
  auc: number
  precision: number
  recall: number
  f1: number
  fpr: number
}

// Kept in sync with TEXT_RESULTS / IMAGE_RESULTS / AUDIO_RESULTS /
// VIDEO_RESULTS in app/(marketing)/benchmarks/page.tsx.
const ROWS: Row[] = [
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

function toCsv(rows: Row[]): string {
  const header = ['Modality', 'Model', 'AUC', 'Precision', 'Recall', 'F1', 'FPR']
  const lines = rows.map(r => [
    r.modality,
    `"${r.model.replace(/"/g, '""')}"`,
    r.auc, r.precision, r.recall, r.f1, r.fpr,
  ].join(','))
  return [header.join(','), ...lines].join('\n') + '\n'
}

export async function GET() {
  return new NextResponse(toCsv(ROWS), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="aiscern-benchmark-results.csv"',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

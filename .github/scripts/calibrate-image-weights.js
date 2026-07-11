#!/usr/bin/env node
/**
 * AISCERn — Image Ensemble Weight Calibration (MODULE 4)
 * Runs in GitHub Actions or locally against production Supabase.
 *
 * Unlike calibrate-images.js (which calibrates raw pixel-signal
 * mean/stddev thresholds), this script answers a different question:
 * "if we shift weight from the LLM/HF layers onto the self-hosted
 * Python CV worker, does accuracy improve, hold, or regress?"
 *
 * It does NOT re-run inference or download new images. It reuses data
 * that's already being collected in production:
 *   - `scan_feedback`     — user/admin-confirmed ground truth per scan
 *   - `model_predictions` — the raw per-model score every scan already
 *                           logs (image-brain-v2, python-cv-worker-v3,
 *                           gemini-2.5-flash-vision, HF ViT models,
 *                           pixel-signals-v2 — see model_breakdown in
 *                           analyzeImage(), hf-analyze.ts)
 *
 * For each labeled scan, it reconstructs what the FINAL ensemble score
 * WOULD HAVE BEEN under each candidate weight split (current v8.1 split,
 * plus CV-worker-weighted-up variants), then compares against ground
 * truth to get accuracy/precision/recall/F1 per split.
 *
 * This is evidence, not guessing — per the module's own rule: "measure,
 * do not guess." It does NOT modify hf-analyze.ts. Read the printed table,
 * pick the best-measured split, and apply it by hand (or in a follow-up
 * commit) once there's enough labeled volume to trust the numbers —
 * MIN_SAMPLES below exists specifically to stop you from calibrating off
 * too small a sample.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *   node .github/scripts/calibrate-image-weights.js
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const MIN_SAMPLES  = parseInt(process.env.MIN_SAMPLES || '100')
const THRESHOLD    = parseFloat(process.env.CALIBRATION_THRESHOLD || '0.55')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Candidate weight splits to test. Each must sum to 1.0 across whichever
// components are present for a given scan (CV/HF/LLM availability varies
// per scan, same as the live branching in hf-analyze.ts — a scan where the
// CV worker didn't respond can't be used to test a CV-heavier split).
//
// Baseline mirrors the current v8.1 "full ensemble" branch in hf-analyze.ts
// exactly (Brain 31% + CV 22% + HF 18% + Pixel 9% + LLM 20%).
const CANDIDATE_SPLITS = [
  { label: 'v8.1 baseline (CV 22%)', brain: 0.31, cv: 0.22, hf: 0.18, pixel: 0.09, llm: 0.20 },
  { label: 'CV 40%',                 brain: 0.24, cv: 0.40, hf: 0.12, pixel: 0.06, llm: 0.18 },
  { label: 'CV 55%',                 brain: 0.18, cv: 0.55, hf: 0.08, pixel: 0.04, llm: 0.15 },
]

const HF_MODEL_IDS = [
  'saghi776/aiscern-image-detector', // image_finetuned — adjust to match MODELS.image_* in hf-analyze.ts if renamed
]

async function fetchLabeledScans() {
  // Ground-truth-confirmed image scans only.
  const { data: feedback, error: fErr } = await supabase
    .from('scan_feedback')
    .select('scan_id, ground_truth, scans!inner(id, media_type)')
    .eq('scans.media_type', 'image')

  if (fErr) throw new Error(`scan_feedback query failed: ${fErr.message}`)
  return feedback || []
}

async function fetchPredictionsForScans(scanIds) {
  const CHUNK = 200
  const byScan = new Map()
  for (let i = 0; i < scanIds.length; i += CHUNK) {
    const chunk = scanIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('model_predictions')
      .select('scan_id, model_id, raw_score')
      .in('scan_id', chunk)
      .eq('modality', 'image')
    if (error) throw new Error(`model_predictions query failed: ${error.message}`)
    for (const row of data || []) {
      if (!byScan.has(row.scan_id)) byScan.set(row.scan_id, {})
      byScan.get(row.scan_id)[row.model_id] = row.raw_score
    }
  }
  return byScan
}

function reconstructScore(components, split) {
  const brain = components['image-brain-v2']
  const cv    = components['python-cv-worker-v3']
  const pixel = components['pixel-signals-v2']
  const llm   = components['gemini-2.5-flash-vision']
  const hfIds = Object.keys(components).filter(k => HF_MODEL_IDS.includes(k))
  const hf    = hfIds.length ? hfIds.reduce((s, k) => s + components[k], 0) / hfIds.length : undefined

  if (brain === undefined || pixel === undefined) return null // can't reconstruct without the always-on components

  // Only test a split against scans where the exact same component
  // availability pattern the split assumes actually held — otherwise
  // we'd be silently comparing splits across different information sets.
  const hasCV  = cv  !== undefined
  const hasHF  = hf  !== undefined
  const hasLLM = llm !== undefined
  if (!hasCV) return null // MODULE 4 is specifically about CV-worker weight — only score CV-available scans

  let score = brain * split.brain + cv * split.cv + pixel * split.pixel
  let usedWeight = split.brain + split.cv + split.pixel
  if (hasHF)  { score += hf  * split.hf;  usedWeight += split.hf }
  if (hasLLM) { score += llm * split.llm; usedWeight += split.llm }

  return usedWeight > 0 ? score / usedWeight : null // renormalize if HF/LLM were unavailable for this scan
}

function computeMetrics(predictions) {
  // predictions: [{ predicted: 'AI'|'HUMAN', truth: 'AI'|'HUMAN' }]
  let tp = 0, fp = 0, tn = 0, fn = 0
  for (const p of predictions) {
    if (p.truth === 'AI' && p.predicted === 'AI') tp++
    else if (p.truth === 'HUMAN' && p.predicted === 'AI') fp++
    else if (p.truth === 'HUMAN' && p.predicted === 'HUMAN') tn++
    else if (p.truth === 'AI' && p.predicted === 'HUMAN') fn++
  }
  const total     = tp + fp + tn + fn
  const accuracy  = total > 0 ? (tp + tn) / total : 0
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0
  const recall    = (tp + fn) > 0 ? tp / (tp + fn) : 0
  const f1        = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0
  return { tp, fp, tn, fn, accuracy, precision, recall, f1, n: total }
}

async function main() {
  console.log('Fetching labeled image scans (scan_feedback)...')
  const feedback = await fetchLabeledScans()
  console.log(`Found ${feedback.length} ground-truth-labeled image scans.`)

  if (feedback.length < MIN_SAMPLES) {
    console.log(`\n⚠️  Only ${feedback.length} labeled samples available (need >= ${MIN_SAMPLES}).`)
    console.log('Not enough volume to trust a weight-split comparison yet — accumulate more')
    console.log('scan_feedback (user corrections / admin review / benchmark runs) before')
    console.log('re-running this script. Refusing to print a misleading result.')
    process.exit(0)
  }

  const scanIds = feedback.map(f => f.scan_id)
  console.log('Fetching per-model predictions for those scans...')
  const predictionsByScan = await fetchPredictionsForScans(scanIds)

  const results = {}
  for (const split of CANDIDATE_SPLITS) {
    const evaluated = []
    for (const f of feedback) {
      const components = predictionsByScan.get(f.scan_id)
      if (!components) continue
      const score = reconstructScore(components, split)
      if (score === null) continue
      evaluated.push({
        predicted: score >= THRESHOLD ? 'AI' : 'HUMAN',
        truth: f.ground_truth,
      })
    }
    results[split.label] = { metrics: computeMetrics(evaluated), n: evaluated.length }
  }

  console.log('\n─────────────────────────────────────────────────────────')
  console.log('MODULE 4 — Image Ensemble Weight Calibration Result')
  console.log('─────────────────────────────────────────────────────────')
  console.log(`Threshold: ${THRESHOLD}   Total labeled scans: ${feedback.length}\n`)
  for (const [label, r] of Object.entries(results)) {
    const m = r.metrics
    console.log(`${label}`)
    console.log(`  n=${r.n} (CV-worker-available scans only)`)
    console.log(`  Accuracy: ${(m.accuracy * 100).toFixed(1)}%  Precision: ${(m.precision * 100).toFixed(1)}%  Recall: ${(m.recall * 100).toFixed(1)}%  F1: ${(m.f1 * 100).toFixed(1)}%`)
    console.log(`  Confusion: TP=${m.tp} FP=${m.fp} TN=${m.tn} FN=${m.fn}\n`)
  }

  const best = Object.entries(results)
    .filter(([, r]) => r.n >= Math.min(MIN_SAMPLES, 30))
    .sort((a, b) => b[1].metrics.accuracy - a[1].metrics.accuracy)[0]

  if (best) {
    console.log(`✅ Best measured split: ${best[0]} (accuracy ${(best[1].metrics.accuracy * 100).toFixed(1)}%)`)
    console.log('Do NOT apply this to hf-analyze.ts based on this printout alone if the sample')
    console.log('sizes for different splits are close/small — re-run with more data first.')
  } else {
    console.log('No split had enough CV-available labeled samples for a reliable comparison.')
  }

  const fs = require('fs')
  fs.writeFileSync(
    'docs/CALIBRATION_LOG.md',
    `# Image Ensemble Calibration Log\n\n` +
    `Last run: ${new Date().toISOString()}\n` +
    `Labeled samples: ${feedback.length} (threshold=${THRESHOLD})\n\n` +
    `| Split | n | Accuracy | Precision | Recall | F1 |\n` +
    `|---|---|---|---|---|---|\n` +
    Object.entries(results).map(([label, r]) =>
      `| ${label} | ${r.n} | ${(r.metrics.accuracy * 100).toFixed(1)}% | ${(r.metrics.precision * 100).toFixed(1)}% | ${(r.metrics.recall * 100).toFixed(1)}% | ${(r.metrics.f1 * 100).toFixed(1)}% |`
    ).join('\n') + '\n\n' +
    (best ? `**Best measured split:** ${best[0]}\n\n` : '') +
    `Weight constants live in \`frontend/lib/inference/hf-analyze.ts\`, in the branch logic\n` +
    `starting at the \`if (cvAvailable && hfAvailable && llmAvailable)\` block (search for\n` +
    `"IMAGE ENSEMBLE v8" in that file). Update the weight literals there — and the\n` +
    `accompanying WEIGHT RATIONALE comment block — if you act on this result, citing this\n` +
    `run's date and sample size in the comment, per MODULE 4 task 4.\n`,
    'utf8'
  )
  console.log('\nWritten to docs/CALIBRATION_LOG.md')
}

main().catch(e => { console.error(e); process.exit(1) })

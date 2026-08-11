#!/usr/bin/env node
/**
 * AISCERn — Video Calibration Script (MODULE 1, task 7)
 * Runs in GitHub Actions (Node.js, no CPU limits) or locally.
 *
 * Mirrors calibrate-images.js's structure: pull a labeled sample set of
 * real vs AI-generated video clips, run each through the self-hosted
 * signal-worker's POST /analyze/video (the frame-sampled image-engine-reuse
 * path from MODULE 1), and report accuracy/precision/recall.
 *
 * PURPOSE: video_engine.py's composite score is currently weighted at 40%
 * (VIDEO_CV_WORKER_WEIGHT in frontend/lib/inference/hf-analyze.ts) as a
 * conservative starting point — "image-engine reuse is proven tech but new
 * to video context, don't over-trust immediately." This script is how you
 * earn the right to raise that weight: run it, look at the numbers, don't
 * guess.
 *
 * Sample set: point AI_VIDEO_URLS_FILE / REAL_VIDEO_URLS_FILE at a
 * newline-delimited list of URLs to labeled clips (one label set per file).
 * This repo does not ship a labeled dataset — building/curating one is a
 * prerequisite for a meaningful calibration run, same as the image
 * calibration script assumes DiffusionDB/Unsplash access.
 *
 * Usage:
 *   PYTHON_WORKER_URL=... \
 *   AI_VIDEO_URLS_FILE=./ai-video-urls.txt \
 *   REAL_VIDEO_URLS_FILE=./real-video-urls.txt \
 *   node .github/scripts/calibrate-video.js
 *
 * Runtime: dominated by /analyze/video's per-frame image_engine cost
 * (8-16 frames × ~2-4s each per clip) — budget accordingly for larger
 * sample sets.
 */

const fs   = require('fs')
const path = require('path')

const PYTHON_WORKER_URL   = process.env.PYTHON_WORKER_URL || ''
const AI_VIDEO_URLS_FILE  = process.env.AI_VIDEO_URLS_FILE || ''
const REAL_VIDEO_URLS_FILE = process.env.REAL_VIDEO_URLS_FILE || ''
const THRESHOLD            = parseFloat(process.env.CALIBRATION_THRESHOLD || '0.55')
const CONCURRENCY          = parseInt(process.env.CONCURRENCY || '3') // keep low — each call is expensive server-side

if (!PYTHON_WORKER_URL) {
  console.error('Missing required env var: PYTHON_WORKER_URL')
  process.exit(1)
}
if (!AI_VIDEO_URLS_FILE || !REAL_VIDEO_URLS_FILE) {
  console.error('Missing required env vars: AI_VIDEO_URLS_FILE, REAL_VIDEO_URLS_FILE')
  console.error('(newline-delimited lists of URLs to labeled video clips)')
  process.exit(1)
}

function readUrlList(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
}

async function downloadVideo(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf
}

async function analyzeVideoClip(buffer, mimeType = 'video/mp4') {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mimeType }), 'video.mp4')
  const res = await fetch(`${PYTHON_WORKER_URL}/analyze/video`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`/analyze/video returned ${res.status} ${res.statusText}`)
  return res.json()
}

async function runBatch(urls, label) {
  const results = []
  let i = 0
  async function worker() {
    while (i < urls.length) {
      const idx = i++
      const url = urls[idx]
      try {
        const buf    = await downloadVideo(url)
        const result = await analyzeVideoClip(buf)
        if (result.status !== 'success') {
          console.warn(`  [${label}] ${url} → worker error: ${result.error}`)
          continue
        }
        results.push({
          url,
          composite_cv_score: result.composite_cv_score,
          temporal_flagged:   result.temporal_variance?.flagged ?? false,
          frames_analyzed:    result.frames_analyzed,
        })
        console.log(`  [${label}] ${url} → score=${result.composite_cv_score.toFixed(3)} frames=${result.frames_analyzed}`)
      } catch (e) {
        console.warn(`  [${label}] ${url} → failed: ${e.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

function computeMetrics(aiResults, realResults, threshold) {
  const tp = aiResults.filter(r => r.composite_cv_score >= threshold).length
  const fn = aiResults.length - tp
  const tn = realResults.filter(r => r.composite_cv_score < threshold).length
  const fp = realResults.length - tn

  const total     = tp + fn + tn + fp
  const accuracy  = total > 0 ? (tp + tn) / total : 0
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0
  const recall    = (tp + fn) > 0 ? tp / (tp + fn) : 0
  const f1        = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0

  return { tp, fn, tn, fp, accuracy, precision, recall, f1 }
}

async function main() {
  const aiUrls   = readUrlList(AI_VIDEO_URLS_FILE)
  const realUrls = readUrlList(REAL_VIDEO_URLS_FILE)

  console.log(`Calibrating self-hosted video CV worker against ${aiUrls.length} AI + ${realUrls.length} real clips`)
  console.log(`Worker: ${PYTHON_WORKER_URL}  Threshold: ${THRESHOLD}\n`)

  console.log('Analyzing AI-generated samples...')
  const aiResults = await runBatch(aiUrls, 'AI')

  console.log('\nAnalyzing real/authentic samples...')
  const realResults = await runBatch(realUrls, 'REAL')

  const metrics = computeMetrics(aiResults, realResults, THRESHOLD)

  console.log('\n─────────────────────────────────────────')
  console.log('MODULE 1 — Video CV Worker Calibration Result')
  console.log('─────────────────────────────────────────')
  console.log(`AI samples analyzed:   ${aiResults.length}/${aiUrls.length}`)
  console.log(`Real samples analyzed: ${realResults.length}/${realUrls.length}`)
  console.log(`Threshold:             ${THRESHOLD}`)
  console.log(`Accuracy:              ${(metrics.accuracy * 100).toFixed(1)}%`)
  console.log(`Precision:             ${(metrics.precision * 100).toFixed(1)}%`)
  console.log(`Recall:                ${(metrics.recall * 100).toFixed(1)}%`)
  console.log(`F1:                    ${(metrics.f1 * 100).toFixed(1)}%`)
  console.log(`Confusion: TP=${metrics.tp} FN=${metrics.fn} TN=${metrics.tn} FP=${metrics.fp}`)
  console.log('─────────────────────────────────────────')
  console.log(
    metrics.accuracy >= 0.85
      ? '\n✅ Accuracy at or above 85% — safe to consider raising VIDEO_CV_WORKER_WEIGHT above 0.40 in hf-analyze.ts.'
      : '\n⚠️  Accuracy below 85% — do NOT raise VIDEO_CV_WORKER_WEIGHT yet. Investigate false positives/negatives above first.'
  )

  const outPath = path.join(process.cwd(), 'video-calibration-result.json')
  fs.writeFileSync(outPath, JSON.stringify({ metrics, aiResults, realResults, threshold: THRESHOLD, ranAt: new Date().toISOString() }, null, 2))
  console.log(`\nFull results written to ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })

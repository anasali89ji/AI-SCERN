#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// AISCERN — remote worker health probe (IMG-WORKER-1 companion tool)
//
// Diagnoses the "Image detection aborted — required worker(s) unavailable:
// CV worker (DigitalOcean), GPU worker (HF ZeroGPU)" failure in one command.
// No dependencies — plain Node 18+.
//
// Usage (from the repo root, Git Bash friendly):
//   node scripts/check-workers.mjs                        # URLs from env vars
//   node scripts/check-workers.mjs --cv URL --gpu URL     # explicit URLs
//   node scripts/check-workers.mjs --deep                 # + live analysis calls
//
//   CV worker  = PYTHON_WORKER_URL  (DigitalOcean signal-worker, /analyze/image)
//   GPU worker = HF_GPU_WORKER_URL  (HF ZeroGPU Space, Gradio /call/ API)
//
// What each check does:
//   CV  shallow : GET /health        — is the worker up, which engines respond
//   CV  deep    : POST /analyze/image with a tiny embedded JPEG — real
//                 end-to-end latency + response-shape check (the same call
//                 image scans make). Small image => much faster than a real
//                 1024px scan (~32s); this just proves the route works.
//   GPU shallow : GET /config        — Space awake + exposes the api_names the
//                 frontend depends on (diffusion_inversion, diffusion_snapback)
//   GPU deep    : /call/ping round trip — Gradio queue + function execution
//                 actually work (catches ZeroGPU quota / broken deployments)
//
// Exit code: 0 = all probed workers healthy, 1 = at least one problem.
// ════════════════════════════════════════════════════════════════════════════

const args      = process.argv.slice(2)
const deep      = args.includes('--deep')
const argAfter  = (flag) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : null }

const CV_URL  = argAfter('--cv')  ?? process.env.PYTHON_WORKER_URL  ?? null
const GPU_URL = argAfter('--gpu') ?? process.env.HF_GPU_WORKER_URL  ?? null

// 64x64 random-noise JPEG — small enough that even a slow CV worker analyzes
// it quickly, valid enough to pass the image/ decode checks.
const TINY_JPEG_B64 =
  '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'

const results = []
const note = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? '  [PASS]' : '  [FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function timedFetch(url, opts = {}, timeoutMs = 10000) {
  const t0 = Date.now()
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) })
  return { res, ms: Date.now() - t0 }
}

function readSse(text) {
  let event = 'unknown', data = null
  for (const line of text.split('\n')) {
    const ev = line.match(/^event:\s*(.*)$/); if (ev) { event = ev[1].trim(); continue }
    const da = line.match(/^data:\s*(.*)$/); if (da) { try { data = JSON.parse(da[1]) } catch { data = da[1] } }
  }
  return { event, data }
}

// ── CV worker (DigitalOcean signal-worker) ──────────────────────────────────
async function checkCv() {
  console.log('\n─ CV worker (DigitalOcean signal-worker)')
  if (!CV_URL) {
    note('configured', false, 'no URL — pass --cv URL or set PYTHON_WORKER_URL')
    return
  }
  note('configured', true, CV_URL)

  let health
  try {
    const { res, ms } = await timedFetch(`${CV_URL}/health`, {}, 8000)
    health = { res, ms }
  } catch (err) {
    note('GET /health', false, `${err.name === 'TimeoutError' ? 'timeout' : err.message} — droplet/app down or URL wrong. Restart it in the DigitalOcean console (Apps → aiscern-detection-worker → … → Restart)`)
    return
  }
  if (!health.res.ok) { note('GET /health', false, `HTTP ${health.res.status}`); return }
  const h = await health.res.json()
  const engines = Object.entries(h.engines ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')
  note('GET /health', true, `v${h.version} in ${health.ms}ms; engines: ${engines || 'unknown'}`)

  if (!deep) { console.log('  (add --deep to POST a real /analyze/image probe)'); return }

  try {
    const form = new FormData()
    form.append('file', new Blob([Buffer.from(TINY_JPEG_B64, 'base64')], { type: 'image/jpeg' }), 'probe.jpg')
    const { res, ms } = await timedFetch(`${CV_URL}/analyze/image`, { method: 'POST', body: form }, 60000)
    if (!res.ok) { note('POST /analyze/image (deep)', false, `HTTP ${res.status} — the exact call image scans make is failing`); return }
    const d = await res.json()
    note('POST /analyze/image (deep)', typeof d.composite_cv_score === 'number',
      `${ms}ms, composite_cv_score=${d.composite_cv_score}${ms > 40000 ? ' (slow — a real 1024px image will be slower; consider upgrading the instance)' : ''}`)
  } catch (err) {
    note('POST /analyze/image (deep)', false, `${err.name === 'TimeoutError' ? 'timeout' : err.message}`)
  }
}

// ── GPU worker (HF ZeroGPU Space) ───────────────────────────────────────────
async function checkGpu() {
  console.log('\n─ GPU worker (HF ZeroGPU Space)')
  if (!GPU_URL) {
    note('configured', false, 'no URL — pass --gpu URL or set HF_GPU_WORKER_URL')
    return
  }
  note('configured', true, GPU_URL)

  let cfg
  try {
    const { res, ms } = await timedFetch(`${GPU_URL}/config`, {}, 10000)
    if (!res.ok) { note('GET /config', false, `HTTP ${res.status} — Space asleep, building, or crashed. Open the Space page, check its runtime logs, and restart/rebuild it`); return }
    cfg = await res.json()
    note('GET /config', true, `Gradio ${cfg.version ?? '?'} in ${ms}ms`)
  } catch (err) {
    note('GET /config', false, `${err.name === 'TimeoutError' ? 'timeout — Space is likely asleep (first request after wake can take 30-60s; retry once)' : err.message}`)
    return
  }

  const names = [...new Set((cfg.dependencies ?? []).map(d => d.api_name).filter(n => typeof n === 'string'))]
  const hasL5 = names.includes('diffusion_inversion'), hasL5b = names.includes('diffusion_snapback')
  if (hasL5 && hasL5b) {
    note('api contract', true, `exposes [${names.join(', ')}] — matches the frontend client`)
  } else {
    note('api contract', false,
      `Space exposes [${names.join(', ') || 'none'}] but the frontend calls diffusion_inversion + diffusion_snapback. The Space is running DIFFERENT code than hf-space-gpu-worker/ — redeploy it from that directory (see docs/IMG_WORKER_RECOVERY.md)`)
  }

  if (!deep) { console.log('  (add --deep to run a /call/ping round trip)'); return }

  try {
    const sub = await timedFetch(`${GPU_URL}/call/ping`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [] }),
    }, 15000)
    if (!sub.res.ok) { note('/call/ping round trip (deep)', false, `submit HTTP ${sub.res.status}`); return }
    const { event_id } = await sub.res.json()
    if (!event_id) { note('/call/ping round trip (deep)', false, 'no event_id'); return }
    const sse = await timedFetch(`${GPU_URL}/call/ping/${event_id}`, {}, 30000)
    if (!sse.res.ok) { note('/call/ping round trip (deep)', false, `result HTTP ${sse.res.status}`); return }
    const { event } = readSse(await sse.res.text())
    if (event === 'complete') note('/call/ping round trip (deep)', true, `${sub.ms + sse.ms}ms`)
    else note('/call/ping round trip (deep)', false, `event=${event} — Gradio queue works but function execution fails. Check the Space runtime logs (ZeroGPU quota exhausted? import error? OOM?)`)
  } catch (err) {
    note('/call/ping round trip (deep)', false, `${err.name === 'TimeoutError' ? 'timeout' : err.message}`)
  }
}

// ── run ─────────────────────────────────────────────────────────────────────
console.log('Aiscern worker health probe (IMG-WORKER-1)')
console.log(`mode: ${deep ? 'deep (live analysis calls)' : 'shallow'} — deep CV probe costs ~5-15s`)
if (!CV_URL && !GPU_URL) {
  console.log('\nNo worker URLs. Pass --cv/--gpu or export PYTHON_WORKER_URL / HF_GPU_WORKER_URL,')
  console.log('e.g.:  node scripts/check-workers.mjs --cv https://aiscern-detection-worker-xxxx.ondigitalocean.app --gpu https://user-ai-scern-signal-worker-l5-l5b.hf.space')
}
await checkCv()
await checkGpu()

const failed = results.filter(r => !r.pass).length
console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'} — see docs/IMG_WORKER_RECOVERY.md for recovery steps`)
process.exit(failed === 0 ? 0 : 1)

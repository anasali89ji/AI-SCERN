# Full Website Scanner v2 — Forensic Content Authenticity Platform

New capability added on top of the existing single-page `/api/detect/web` route:
crawl an **entire site**, run the existing text + image detection engines on
every page, detect WordPress, and report sitewide AI-content / AI-image
percentages.

## New files

```
frontend/lib/site-crawler/crawler.ts          — sitemap-first crawler, robots.txt aware, WordPress fingerprinting
frontend/lib/site-crawler/extract-article.ts  — boilerplate-stripping article/text extractor
frontend/lib/site-crawler/forensics.ts        — v2: SimHash dedup, content depth, stylometry/voice diversity,
                                                  AI artifact/watermark scan, EXIF heuristics, transparency +
                                                  link-trust scoring, lightweight internal PageRank, WordPress
                                                  plugin/theme fingerprinting, integrity seal hashing
frontend/lib/site-crawler/site-scanner.ts     — wires crawler + forensics.ts → analyzeText/analyzeTextWithBrain/
                                                  analyzeImage, aggregates sitewide + per-page results
frontend/app/api/detect/site/route.ts         — POST /api/detect/site
frontend/app/api/verify/[hash]/route.ts       — GET  /api/verify/:hash — integrity-seal lookup for "Verified
                                                  Content" badges
```

## v2 forensic layer

| Feature (from the improvement brief) | Status | Where |
|---|---|---|
| Intra-site duplicity / spin detection (SimHash clustering) | ✅ | `forensics.ts: simhash, clusterDuplicates` |
| Content Depth Score / thin-content flag | ✅ | `forensics.ts: contentDepthScore` |
| Stylometric consistency / Voice Diversity Index | ✅ | `forensics.ts: stylometricProfile, voiceDiversityIndex` |
| AI stop-phrase / prompt-residue / zero-width watermark scan | ✅ | `forensics.ts: findAiArtifacts` |
| EXIF heuristics (generator tags, Apple+Photoshop contradiction) | ✅ | `forensics.ts: scanExifFlags` — raw-byte ASCII scan, no EXIF lib dependency |
| Transparency score (contact/privacy/terms) | ✅ | `forensics.ts: computeTransparency` |
| Out-link trust score (authoritative vs. suspicious TLDs) | ✅ | `forensics.ts: computeLinkTrust` |
| Internal PageRank + "buried high-AI page" flag (cloaking hint) | ✅ | `forensics.ts: lightweightPageRank`, `site-scanner.ts: buriedHighAi` |
| Sections/sitemap AI heatmap by path prefix | ✅ | `site-scanner.ts: sectionsHeatmap` |
| WordPress plugin/theme fingerprinting + known AI-content-plugin flag | ✅ (offline slug list; no live WPScan feed) | `forensics.ts: extractWordPressAssets` |
| Ensemble verdict (HF ensemble + linguistic brain + forensic penalties) | ✅ | `site-scanner.ts: scanSite` blend (55/30/15) |
| Remediation report (per-URL/per-image actions) | ✅ | `site-scanner.ts: remediation` |
| Content Integrity Seal + verification endpoint | ✅ (non-cryptographic FNV hash; swap for `crypto.subtle.digest` if a collision-resistant seal is required) | `forensics.ts: computeIntegritySeal`, `app/api/verify/[hash]/route.ts` |
| **Deferred — needs infra/assets beyond a backend module:** |
| ONNX ViT-Tiny/EfficientNet in-browser image model | ⏭ Roadmap | Needs a compiled <10MB ONNX asset + onnxruntime-web bundle; not something to hand-roll without a real trained checkpoint. `analyzeImage()`'s existing Brain (pixel/frequency/noise) + optional Python CV worker fill this role today. |
| Multi-patch ELA / DCT histogram forensics | ⏭ Roadmap | Belongs in the Python signal-worker (`signal-worker/analyzers/`) alongside the existing pixel-forensics layers, not the Node/Edge frontend — flagging for that repo. |
| WPScan live vulnerability cross-reference | ⏭ Roadmap | `extractWordPressAssets()` already returns slugs; wire the free WPScan JSON feed into a lookup once an API key/rate-limit strategy is chosen. |
| SSE crawl-progress streaming | ⏭ Roadmap | Route currently returns one JSON payload after the full scan; converting to SSE needs a client-side change too (not just the API route). |
| Cloudflare Workers KV caching / incremental re-scan by ETag/lastmod | ⏭ Roadmap | `crawler.ts` already reads `sitemap.xml <lastmod>` in principle (parseable from the same regex pass) — wiring a KV-backed diff needs a KV namespace binding decision in `cf-workers/wrangler.toml`. |
| 3-gram perplexity-burst model | ⏭ Roadmap | Needs a ~20MB serialized LM asset; `analyzeTextWithBrain()`'s existing burstiness/perplexity-adjacent signals (sentence uniformity, TTR, MTLD) currently approximate this without extra assets. |
| Time-based drift monitoring / Content Integrity Timeline | ⏭ Roadmap | Needs scan history diffing against the `scans` table by origin — straightforward SQL once product wants it; not added here to avoid a schema migration in this pass. |

These deferred items are flagged rather than stubbed with fake output, since
placeholder ONNX/ELA/WPScan results would misrepresent the report's actual
forensic confidence.

## Why it works without Gemini / at (near) zero cost

- **Crawling**: plain `fetch()` only — no headless browser, no Puppeteer. Runs
  fine on Vercel serverless/edge or inside a Cloudflare Worker (or Cloudflare
  Cron Trigger for scheduled re-scans of the same site).
- **Discovery**: sitemap.xml / sitemap_index.xml first (cheap, complete, no
  HTML parsing needed), falls back to a bounded BFS same-domain link crawl
  only if no sitemap is found. `robots.txt` `Disallow` rules are respected.
- **Text engine**: reuses `analyzeText()` (HF ensemble) + `analyzeTextWithBrain()`
  (pure local linguistic-signal brain — zero external calls) — identical
  engines already wired into `/api/detect/web`.
- **Image engine**: reuses `analyzeImage()` from `lib/inference/hf-analyze.ts`.
  This function already degrades gracefully with **no** `GEMINI_API_KEY` set —
  it runs the free, self-hosted Image Detection Brain (pixel/frequency/noise
  forensics) plus your optional Python CV worker (`PYTHON_WORKER_URL`, the
  DigitalOcean signal-worker), and only adds Gemini as one *extra* voting
  signal if a key happens to be configured. The site scanner deliberately
  does **not** call `semantic-rag.ts`'s 9-agent vision cascade, because that
  module hard-throws if none of `GROK_API_KEY` / `GEMINI_API_KEY` /
  `OPENROUTER_API_KEY` are set. This keeps the whole feature runnable for
  free.
- **WordPress detection**: `wp-content/`, `wp-includes/`, `wp-json`,
  `<meta name="generator" content="WordPress...">`, and Gutenberg block
  classes. WordPress `wp-content/uploads` images are prioritised in the image
  queue since that's where actual post media lives (vs. theme chrome).

## API

```
POST /api/detect/site
{
  "url": "https://example.com",
  "maxPages": 25,          // optional, hard cap 60
  "includeImages": true,   // optional
  "maxImagesTotal": 15     // optional, hard cap 40
}
```

Response (`SiteScanResult`):

```jsonc
{
  "success": true,
  "origin": "https://example.com",
  "isWordPress": true,
  "discoveryMethod": "sitemap",
  "pagesScanned": 25,
  "pagesFailed": 0,
  "aiContentPercent": 42.0,
  "aiImagePercent": 18.5,
  "totalTextWords": 38120,
  "totalImagesFound": 61,
  "totalImagesScanned": 15,

  "contentOriginalityScore": 0.67,
  "voiceDiversityIndex": 0.34,
  "duplicateClusters": [["https://example.com/blog/a", "https://example.com/blog/b"]],
  "transparencyScore": 0.67,
  "linkTrustScore": 0.7,
  "sectionsHeatmap": [
    { "pathPrefix": "/blog/", "aiContentPercent": 78, "pageCount": 15 },
    { "pathPrefix": "/products/", "aiContentPercent": 5, "pageCount": 8 }
  ],
  "wordPressAssets": [ { "slug": "ai-content-writer", "type": "plugin", "isKnownAiContentTool": true } ],
  "remediation": [
    { "type": "page", "url": "https://example.com/blog/a", "action": "Rewrite or de-duplicate", "reason": "AI-scored and part of a near-duplicate/spun content cluster" },
    { "type": "image", "imageUrl": "https://example.com/img.jpg", "pageUrl": "https://example.com/blog/a", "action": "Replace or verify licensing", "reason": "EXIF metadata contains generator marker(s): Software/Comment tag contains \"Stable Diffusion\"" }
  ],
  "integritySeal": { "hash": "a1b2c3d4e5f60718", "verificationNote": "..." },

  "pages": [
    {
      "url": "...", "title": "...", "wordCount": 812, "aiScore": 0.71, "verdict": "AI",
      "topFindings": ["..."],
      "contentDepthScore": 0.41,
      "ensembleSignals": { "hfEnsemble": 0.72, "linguisticBrain": 0.68, "isSpun": false, "isThinContent": false, "aiArtifactHits": 1 },
      "aiArtifacts": [ { "phrase": "it's important to note that", "where": "body" } ],
      "pageRank": 0.62,
      "buriedHighAi": false
    }
  ],
  "images": [ { "pageUrl": "...", "imageUrl": "...", "aiScore": 0.83, "verdict": "AI", "modelUsed": "brain+cv-worker", "exifFlags": [] } ]
}
```

## Verifying an integrity seal

```
GET /api/verify/a1b2c3d4e5f60718
→ { "success": true, "verified": true, "origin": "...", "aiContentPercent": 42.0, "scannedAt": "..." }
```

## Cost controls

- `maxPages` hard-capped at 60 pages/scan.
- `maxImagesTotal` hard-capped at 40 images/scan (budget spent across pages
  in crawl order, `maxImagesPerPage` defaults to 3).
- Images >8MB are skipped (unlikely to be genuine content images).
- Uses the existing `scraper` rate-limit bucket + `creditGuard('site', ...)`
  so it's metered the same way as every other `/api/detect/*` route.

## v2 — Forensic Content Authenticity Platform

Layered on top of the base scanner, all pure-JS/zero-cost:

| Feature | File | What it adds |
|---|---|---|
| Spin/duplicate detection | `simhash.ts` | 64-bit SimHash per page, clusters near-duplicates (>90% similar) → `duplicateClusters`, feeds `contentOriginalityScore` |
| Thin-content flag | `simhash.ts` | `contentDepthScore()` (length + unique-trigram ratio) → `ensembleSignals.isThinContent` |
| Voice Diversity Index | `stylometry.ts` | Sentence length, TTR, hapax rate, function-word freq, punctuation → sitewide `voiceDiversityIndex` (low = single-source/AI/template) |
| AI artifact hints | `ai-artifacts.ts` | LLM stop-phrases, zero-width watermark chars, leaked image-gen prompt residue in alt text/captions |
| Site trust | `site-trust.ts` | `transparencyScore` (contact/privacy/ToS/address), `linkTrustScore` (outbound TLD reputation), internal PageRank (flags AI content buried deep — cloaking pattern) |
| WordPress deep scan | `wordpress-deep.ts` | Plugin/theme slugs from asset URLs, known AI-writer plugin fingerprints, Gutenberg-splice detection, optional best-effort WPScan vuln lookup (`checkWpVulnerabilities: true`) |
| Section heatmap | `site-scanner.ts` | Per URL-path-prefix (e.g. `/blog/`) AI-content percentage, sorted worst-first |
| Remediation report | `site-scanner.ts` | Concrete per-URL actions ("rewrite", "merge duplicate", "replace image") with reasons, not just scores |
| Integrity Seal | `integrity-seal.ts` + `supabase/migrations/v24_site_scan_seals.sql` | SHA-256 hash of the scan summary, persisted (best-effort) and checkable at `GET /api/verify/site/[hash]` for an embeddable "Verified Content" badge |

`SiteScanOptions` additions: `issueSeal` (default `true`), `checkWpVulnerabilities` (default `false`, extra network call to a free WPScan snapshot — silently skipped if unreachable).

**Not implemented in this pass** (flagged for a follow-up, since they need either
new heavy deps or persistent infra this repo doesn't have wired yet):
ONNX-based on-device image model, DCT/multi-patch ELA image forensics, EXIF
heuristics, n-gram perplexity burst scoring, SSE progress streaming, Workers
KV page-fingerprint caching, incremental re-scan/drift timeline, and
priority-BFS crawling. The current image engine (`analyzeImage()`) already
covers pixel/frequency/noise forensics server-side (see `image-detection-brain.ts`
via the Python CV worker) — the ONNX/ELA/DCT items above would be additive,
browser-side redundancy for that same signal family.

## Cloudflare option

Because the crawler is pure `fetch()`, `crawlSite()` / `scanSite()` can be
lifted into a Cloudflare Worker almost unchanged (Workers' `fetch` API is a
subset of the standard one used here). For scheduled re-scans of the same
site (e.g. nightly WordPress content audits), wire it to a Cron Trigger in
`cf-pipeline/wrangler.toml` and have the Worker POST results back to
`/api/detect/site` webhook-style, or call `scanSite()` directly if ported.
No code in `crawler.ts`/`site-scanner.ts` uses Node-only APIs except
`Buffer` in `site-scanner.ts`'s image fetch (swap for `Uint8Array` if you
port that file to a Worker).

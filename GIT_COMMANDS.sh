#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
# AISCERN Scanner v2.0 — Git Bash Commands
# Run these in Git Bash from your AI-SCERN repo root
# ════════════════════════════════════════════════════════════════════════════

# STEP 1: Navigate to your repo (adjust path as needed)
cd ~/AI-SCERN

# STEP 2: Create the new directory structure
mkdir -p frontend/lib/scanner
mkdir -p frontend/lib/scanner/__tests__
mkdir -p frontend/app/api/scanner
mkdir -p frontend/app/api/verify/seal
mkdir -p "frontend/app/(dashboard)/scanner"

# STEP 3: Copy all updated files from the extracted zip
# (Assumes you extracted aiscern-scanner-update.zip to /tmp/scanner-update)
cp -r /tmp/scanner-update/frontend/lib/scanner/* frontend/lib/scanner/
cp -r /tmp/scanner-update/frontend/app/api/scanner/* frontend/app/api/scanner/
cp -r /tmp/scanner-update/frontend/app/api/verify/seal/* frontend/app/api/verify/seal/
cp -r "/tmp/scanner-update/frontend/app/(dashboard)/scanner/"* "frontend/app/(dashboard)/scanner/"
cp /tmp/scanner-update/README-SCANNER-UPDATE.md .

# STEP 4: Install required dependency
npm install cheerio
# OR: pnpm add cheerio
# OR: yarn add cheerio

# STEP 5: Verify TypeScript compiles
npx tsc --noEmit

# STEP 6: Stage all changes
git add frontend/lib/scanner/
git add frontend/app/api/scanner/
git add frontend/app/api/verify/seal/
git add "frontend/app/(dashboard)/scanner/"
git add package.json package-lock.json

# STEP 7: Commit with descriptive message
git commit -m "feat(scanner): v2.0 forensic web scanner with ensemble AI detection

- Integrate text-detection-brain + image-detection-brain into web scanner
- Remove Gemini dependency — pure local computation + free fetch
- Add stylometric analysis (voice diversity, sentence patterns)
- Add duplicity detection (SimHash clustering, spin detection)
- Add perplexity burst engine (n-gram based)
- Add deep WordPress scanning (plugins, themes, AI fingerprints)
- Add free image forensics (ELA, DCT, EXIF heuristics)
- Add site trust scoring (transparency, link authority, PageRank)
- Add section heatmap for content silo analysis
- Add integrity seal + remediation report
- New dashboard UI with real-time results tabs
- Zero paid APIs required"

# STEP 8: Push to main branch
git push origin main

# STEP 9: Deploy (if using Vercel)
# vercel --prod

#!/bin/bash
# ============================================================
# DETECTAI - Cloudflare Pipeline Deploy Script
# Run ONCE locally to deploy the Worker + set secrets
#
# Usage:
#   export CLOUDFLARE_API_TOKEN=<your-cf-token>
#   export HF_TOKEN=<your-hf-token>
#   bash cf-pipeline/deploy.sh
# ============================================================
set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "ERROR: export CLOUDFLARE_API_TOKEN=<token> first"; exit 1
fi
if [ -z "$HF_TOKEN" ]; then
  echo "ERROR: export HF_TOKEN=<token> first"; exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/3] Installing deps..."; npm ci --silent
echo "[2/3] Deploying Worker..."; npx wrangler deploy --name detectai-pipeline
echo "[3/3] Setting HF_TOKEN secret..."; echo "$HF_TOKEN" | npx wrangler secret put HF_TOKEN

echo "Done! Crons live: every 2min scrape, every 15min HF push"

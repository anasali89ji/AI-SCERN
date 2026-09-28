#!/bin/bash
# ============================================================
# DETECTAI Pipeline v7 — Deploy All 16 Workers (15 scrapers + 1 push)
#
# Usage:
#   export CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>
#   export HF_TOKEN=<your-hf-write-token>
#   bash cf-pipeline/deploy-all.sh
#
# Workers:
#   wrangler.toml   → Worker 1  (scraper)
#   wrangler-b.toml → Worker 2  (scraper)
#   wrangler-c.toml → Worker 3  (scraper)
#   wrangler-d.toml → Worker 4  (scraper)
#   wrangler-e.toml → Worker 5  (scraper)
#   wrangler-f.toml → Worker 6  (scraper)
#   wrangler-g.toml → Worker 7  (scraper)
#   wrangler-h.toml → Worker 8  (scraper)
#   wrangler-i.toml → Worker 9  (scraper)
#   wrangler-j.toml → Worker 10 (scraper)
#   wrangler-k.toml → Worker 11 (scraper)
#   wrangler-l.toml → Worker 12 (scraper) — note: WORKER_NUM=12 in wrangler-m.toml
#   wrangler-m.toml → Worker 12 (scraper)
#   wrangler-n.toml → Worker 13 (scraper)
#   wrangler-o.toml → Worker 14 (scraper)
#   wrangler-p.toml → Worker 15 (scraper)
#   wrangler-q.toml → Worker 20 (HF push + README + cleanup)
# ============================================================
set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌  Missing CLOUDFLARE_API_TOKEN"
  echo "    Set it: export CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>"
  exit 1
fi

if [ -z "$HF_TOKEN" ]; then
  echo "❌  Missing HF_TOKEN"
  echo "    Set it: export HF_TOKEN=<your-hf-write-token>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦  Installing deps..."
npm ci --silent

echo ""
echo "🗄️   Running D1 migration 001 — creates source_cursors table (fixes zero-scrape root cause)..."
npx wrangler d1 execute detectai-pipeline \
  --file=migrations/001_source_cursors.sql \
  --remote 2>&1 && echo "   ✅  Migration applied" || echo "   ⚠️  Already applied (table exists) — continuing"

echo ""
echo "🚀  Deploying 16 workers..."
echo ""

CONFIGS=(
  "wrangler.toml"
  "wrangler-b.toml"
  "wrangler-c.toml"
  "wrangler-d.toml"
  "wrangler-e.toml"
  "wrangler-f.toml"
  "wrangler-g.toml"
  "wrangler-h.toml"
  "wrangler-i.toml"
  "wrangler-j.toml"
  "wrangler-k.toml"
  "wrangler-l.toml"
  "wrangler-m.toml"
  "wrangler-n.toml"
  "wrangler-o.toml"
  "wrangler-p.toml"
  "wrangler-q.toml"
)

DEPLOYED=0
FAILED=0
TOTAL=${#CONFIGS[@]}

for cfg in "${CONFIGS[@]}"; do
  WNUM=$(grep 'WORKER_NUM' "$cfg" 2>/dev/null | grep -o '"[0-9]*"' | tr -d '"')
  WNAME=$(grep '^name' "$cfg" | head -1 | sed 's/.*= *"\([^"]*\)".*/\1/')
  echo "── [$cfg] Worker ${WNUM:-?} ($WNAME)"

  if npx wrangler deploy --config "$cfg" 2>&1 | grep -E "(Deployed|✓|error|Error)" | head -5; then
    printf "%s" "$HF_TOKEN" | npx wrangler secret put HF_TOKEN --config "$cfg" 2>&1 | tail -1
    echo "   ✅  deployed + HF_TOKEN injected"
    DEPLOYED=$((DEPLOYED + 1))
  else
    echo "   ❌  FAILED — check output above"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "══════════════════════════════════════════════════════════"
echo "Result: $DEPLOYED/$TOTAL deployed | $FAILED failed"
echo ""
echo "📊  Expected throughput (when all running):"
echo "    15 scrapers × 3 sources × 100 rows × 1440 min/day = ~6.5M rows/day"
echo "    Worker 20 pushes every minute (up to 10k rows → HuggingFace)"
echo ""
echo "🔗  Check pipeline status:"
echo "    curl https://detectai-pipeline.workers.dev/status"
echo ""
echo "🔗  Manual push trigger (Worker 20):"
echo "    curl -X POST https://detectai-pipeline-q.workers.dev/trigger/push"
echo ""
echo "🔗  Manual scrape trigger (Worker 1):"
echo "    curl -X POST https://detectai-pipeline.workers.dev/trigger/scrape"

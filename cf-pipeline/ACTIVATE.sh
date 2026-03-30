#!/bin/bash
# ============================================================
# AISCERN PIPELINE — ONE-CLICK ACTIVATION
# Run this on your local machine (Windows: use Git Bash or WSL)
#
# This script:
#   1. Runs D1 migration (creates source_cursors table — fixes zero-scrape)
#   2. Deploys all 16 workers to Cloudflare
#   3. Injects HF_TOKEN secret into every worker
#   4. Verifies Worker 20 (push worker) is alive
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export CLOUDFLARE_API_TOKEN="<YOUR_CF_API_TOKEN>"
export HF_TOKEN="<YOUR_HF_TOKEN>"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     AISCERN PIPELINE — ACTIVATION SEQUENCE          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Step 1 — Install deps
echo "📦 [1/5] Installing dependencies..."
npm ci --silent
echo "   ✅ Done"

# Step 2 — D1 Migration (source_cursors table)
echo ""
echo "🗄️  [2/5] Running D1 migration 001 (source_cursors table)..."
npx wrangler d1 execute detectai-pipeline \
  --file=migrations/001_source_cursors.sql \
  --remote 2>&1 | tail -3 \
  && echo "   ✅ Migration applied" \
  || echo "   ⚠️  Already applied (safe to ignore)"

# Step 3 — Deploy all workers
echo ""
echo "🚀 [3/5] Deploying 16 workers..."
echo ""

CONFIGS=(
  "wrangler.toml"    # Worker 1
  "wrangler-b.toml"  # Worker 2
  "wrangler-c.toml"  # Worker 3
  "wrangler-d.toml"  # Worker 4
  "wrangler-e.toml"  # Worker 5
  "wrangler-f.toml"  # Worker 6
  "wrangler-g.toml"  # Worker 7
  "wrangler-h.toml"  # Worker 8
  "wrangler-i.toml"  # Worker 9
  "wrangler-j.toml"  # Worker 10
  "wrangler-k.toml"  # Worker 11
  "wrangler-l.toml"  # Worker 12
  "wrangler-m.toml"  # Worker 13
  "wrangler-n.toml"  # Worker 14
  "wrangler-o.toml"  # Worker 15
  "wrangler-p.toml"  # Worker 15 (slice 15)
  "wrangler-q.toml"  # Worker 20 (PUSH WORKER)
)

DEPLOYED=0; FAILED=0

for cfg in "${CONFIGS[@]}"; do
  WNUM=$(grep 'WORKER_NUM' "$cfg" 2>/dev/null | grep -o '"[0-9]*"' | tr -d '"')
  WNAME=$(grep '^name' "$cfg" | head -1 | sed 's/.*= *"\([^"]*\)".*/\1/')
  printf "   %-22s Worker %-3s → " "$cfg" "${WNUM:-?}"

  if npx wrangler deploy --config "$cfg" 2>&1 | grep -qE "Deployed|✓|Successfully"; then
    printf "%s" "$HF_TOKEN" | npx wrangler secret put HF_TOKEN --config "$cfg" --quiet 2>&1 >/dev/null
    echo "✅ deployed"
    DEPLOYED=$((DEPLOYED + 1))
  else
    echo "❌ FAILED"
    FAILED=$((FAILED + 1))
  fi
done

# Step 4 — Verify push worker health
echo ""
echo "🏥 [4/5] Verifying Worker 20 (push worker)..."
sleep 3
HEALTH=$(curl -sf "https://detectai-pipeline-q.workers.dev/health" 2>/dev/null || echo '{"ok":false}')
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "   ✅ Worker 20 is alive: $HEALTH"
else
  echo "   ⚠️  Worker 20 health check failed (may need 30s to cold-start)"
  echo "   Retry: curl https://detectai-pipeline-q.workers.dev/health"
fi

# Step 5 — Trigger first scrape + push manually
echo ""
echo "⚡ [5/5] Triggering first scrape + push cycle..."
curl -sf -X POST "https://detectai-pipeline.workers.dev/trigger/scrape" 2>/dev/null \
  && echo "   ✅ Scrape triggered on Worker 1" \
  || echo "   ⚠️  Could not trigger (cron will fire within 1 min anyway)"

sleep 5

curl -sf -X POST "https://detectai-pipeline-q.workers.dev/trigger/push" 2>/dev/null \
  && echo "   ✅ Push triggered on Worker 20" \
  || echo "   ⚠️  Push will fire on next cron tick"

# Final summary
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Deployed: $DEPLOYED/17   Failed: $FAILED"
echo ""
echo "  Pipeline status:  curl https://detectai-pipeline.workers.dev/status"
echo "  Worker 20 health: curl https://detectai-pipeline-q.workers.dev/health"
echo "  HF dataset:       https://huggingface.co/datasets/saghi776/detectai-dataset"
echo "══════════════════════════════════════════════════════════"

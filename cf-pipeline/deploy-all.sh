#!/bin/bash
# DETECTAI Pipeline v3 — Deploy All 5 Workers
# Usage: CLOUDFLARE_API_TOKEN=<token> bash deploy-all.sh

set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌  Missing CLOUDFLARE_API_TOKEN"
  echo "    Usage: CLOUDFLARE_API_TOKEN=your_token bash deploy-all.sh"
  exit 1
fi

# Also need HF_TOKEN as a secret on each worker
if [ -z "$HF_TOKEN" ]; then
  echo "⚠️  HF_TOKEN not set — you'll need to add it as a secret manually:"
  echo "    wrangler secret put HF_TOKEN --config wrangler-b.toml"
  echo ""
fi

echo "🚀  DETECTAI Pipeline v3 — Deploying 5 workers..."
echo ""

deploy() {
  local name=$1
  local config=$2
  echo "──────────────────────────────────────────"
  echo "  Deploying Worker $name ($config)..."
  npx wrangler deploy --config "$config"
  if [ -n "$HF_TOKEN" ]; then
    echo "$HF_TOKEN" | npx wrangler secret put HF_TOKEN --config "$config"
  fi
  echo "  ✅  Worker $name deployed"
  echo ""
}

deploy "A (shards 0–9)"   "wrangler.toml"
deploy "B (shards 10–19)" "wrangler-b.toml"
deploy "C (shards 20–29)" "wrangler-c.toml"
deploy "D (shards 30–39)" "wrangler-d.toml"
deploy "E (shards 40–49 + HF push)" "wrangler-e.toml"

echo "══════════════════════════════════════════"
echo "✅  All 5 workers deployed!"
echo ""
echo "📊  Expected throughput:"
echo "    • 5 workers × 4 shards × 200 items × 1440 min = ~5,760,000 items/day"
echo "    • HuggingFace push: every 10 min (up to 50,000 items per push)"
echo ""
echo "🔗  Status endpoints:"
echo "    https://detectai-pipeline.workers.dev/status"
echo "    https://detectai-pipeline-b.workers.dev/status"
echo "    https://detectai-pipeline-c.workers.dev/status"
echo "    https://detectai-pipeline-d.workers.dev/status"
echo "    https://detectai-pipeline-e.workers.dev/status"
echo ""
echo "💡  Monitor all workers:"
echo "    wrangler tail detectai-pipeline"
echo "    wrangler tail detectai-pipeline-b"
echo "    wrangler tail detectai-pipeline-e"

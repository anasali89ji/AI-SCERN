#!/usr/bin/env bash
# One-time setup on a fresh DigitalOcean GPU Droplet (Ubuntu, AI/ML-ready
# image already has NVIDIA drivers + CUDA + PyTorch preinstalled — this
# just adds the fine-tuning stack on top).
#
# Usage: scp this + build_dataset.py + train.py to the Droplet, then:
#   ssh root@<droplet-ip>
#   bash setup_droplet.sh
set -euo pipefail

pip install -q -U \
  transformers==4.46.3 \
  peft==0.13.2 \
  trl==0.12.1 \
  bitsandbytes==0.44.1 \
  accelerate==1.1.1 \
  datasets==3.1.0

echo "Setup complete. Next:"
echo "  1. scp your aria-knowledge.json + build_dataset.py here (or just aria_sft.jsonl if already built)"
echo "  2. python3 build_dataset.py --out aria_sft.jsonl   # if not already built"
echo "  3. python3 train.py --dataset aria_sft.jsonl --output ./aria-lora-adapter"
echo "  4. scp the adapter back down, or --push-to-hub to skip that step"
echo ""
echo "IMPORTANT: destroy this Droplet when done (not just power off) —"
echo "DigitalOcean bills reserved GPU capacity even while powered off."

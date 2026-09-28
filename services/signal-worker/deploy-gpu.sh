#!/bin/bash
# AISCERN GPU Signal Worker -- deploy to a DigitalOcean GPU Droplet
set -euo pipefail

DROPLET_IP="${1:-${DROPLET_IP:-}}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
REGISTRY="registry.digitalocean.com/aiscern"
IMAGE_LATEST="gpu-worker:latest"
IMAGE_TAG="gpu-worker:$(date +%Y%m%d-%H%M%S)"

if [ -z "$DROPLET_IP" ]; then
    echo "Usage: $0 <DROPLET_IP>"
    echo "  (or set DROPLET_IP env var)"
    exit 1
fi

if [ -z "${INTERNAL_API_SECRET:-}" ]; then
    echo "ERROR: INTERNAL_API_SECRET must be set in your shell environment before deploying."
    echo "  export INTERNAL_API_SECRET=\$(openssl rand -hex 32)"
    exit 1
fi

echo "Building GPU Docker image..."
docker build -f Dockerfile.gpu -t "$REGISTRY/$IMAGE_TAG" -t "$REGISTRY/$IMAGE_LATEST" .

echo "Logging into DigitalOcean Container Registry..."
doctl registry login

echo "Pushing image to registry..."
docker push "$REGISTRY/$IMAGE_TAG"
docker push "$REGISTRY/$IMAGE_LATEST"

echo "Deploying to GPU droplet at $DROPLET_IP..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$DROPLET_IP" INTERNAL_API_SECRET="$INTERNAL_API_SECRET" REGISTRY="$REGISTRY" IMAGE_LATEST="$IMAGE_LATEST" bash -s << 'REMOTE'
    set -e

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
        usermod -aG docker root
        systemctl enable docker && systemctl start docker
    fi

    # Install NVIDIA Container Toolkit if not present
    if ! command -v nvidia-ctk &> /dev/null; then
        distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
        curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
        curl -s -L "https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list" | \
            tee /etc/apt/sources.list.d/nvidia-docker.list
        apt-get update && apt-get install -y nvidia-docker2
        systemctl restart docker
    fi

    # Sanity check GPU is visible inside Docker before proceeding
    docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi || {
        echo "GPU not accessible in Docker -- aborting deploy"
        exit 1
    }

    doctl registry login
    docker pull "$REGISTRY/$IMAGE_LATEST"
    docker stop aiscern-gpu-worker 2>/dev/null || true
    docker rm aiscern-gpu-worker 2>/dev/null || true

    docker run -d \
        --name aiscern-gpu-worker \
        --runtime=nvidia --gpus all \
        -e NVIDIA_VISIBLE_DEVICES=all \
        -e ALLOWED_ORIGINS="https://aiscern.com,https://www.aiscern.com" \
        -e INTERNAL_API_SECRET="$INTERNAL_API_SECRET" \
        -e PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512 \
        -p 8080:8080 \
        --restart unless-stopped \
        --memory=20g --cpus=8 \
        -v aiscern-models:/tmp/aiscern-models \
        "$REGISTRY/$IMAGE_LATEST"

    for i in $(seq 1 30); do
        sleep 5
        if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
            echo "Health check passed!"
            docker logs --tail 20 aiscern-gpu-worker
            exit 0
        fi
        echo "Attempt $i/30..."
    done

    echo "Health check failed"
    docker logs --tail 50 aiscern-gpu-worker
    exit 1
REMOTE

echo "Deployment complete!"
echo "Update your frontend env: SIGNAL_WORKER_URL=http://$DROPLET_IP:8080"
echo "(Recommended: put a Cloudflare Tunnel in front of this instead of exposing port 8080 directly.)"

# AI-SCERN Detection Worker v4.0.0 — DigitalOcean App Platform
# CPU-only build — safe for basic-xs (1GB RAM)
# Key changes from v4.0.0:
#   - torch installed with --index-url for CPU-only wheel (~800MB vs 2.5GB CUDA)
#   - opencv-python → opencv-python-headless (no display server needed)
#   - dlib pre-built wheel via apt (no cmake compile needed → 2min faster build)
#   - Lazy model loading means startup RAM is ~150MB, not 2GB

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Tell OpenCV not to try to use display
ENV OPENCV_IO_ENABLE_OPENEXR=0

# System packages (Debian Trixie compatible)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgles2 \
    libxext6 \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    build-essential \
    python3-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Step 1: Install CPU-only torch FIRST (before requirements.txt)
# This prevents pip from pulling in 2.5GB of CUDA libraries
RUN pip install --no-cache-dir \
    torch==2.3.0 \
    --index-url https://download.pytorch.org/whl/cpu

# Step 2: Install remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Ephemeral model cache
RUN mkdir -p /tmp/aiscern-models && chmod 777 /tmp/aiscern-models

# Non-root user
RUN useradd -m -u 1000 worker && chown -R worker:worker /app
USER worker

EXPOSE 8080

# Longer start period — dlib + face_recognition load on first request (lazy)
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["python", "main.py"]

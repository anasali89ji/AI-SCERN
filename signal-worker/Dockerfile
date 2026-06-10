# AI-SCERN Detection Worker v4.0.0 — DigitalOcean App Platform Dockerfile
# Supports: image forensics (v2+v3), text detection, OCR, face recognition
# GPU layers (L5, L5b) are disabled by default; enable with GPU_ENABLED=true

FROM python:3.11-slim

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# System packages:
#  - OpenCV:           libgl1-mesa-glx, libglib2.0-0, libsm6, libxext6, libxrender-dev, libgomp1
#  - Tesseract OCR:    tesseract-ocr, tesseract-ocr-eng, libtesseract-dev
#  - dlib/face-recognition: cmake, libopenblas-dev, liblapack-dev, libx11-dev, libgtk-3-dev
#  - Build tools:      build-essential, wget
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create model cache directory (ephemeral, lost on restart — expected behaviour)
RUN mkdir -p /tmp/aiscern-models && chmod 777 /tmp/aiscern-models

# Non-root user for security
RUN useradd -m -u 1000 worker && chown -R worker:worker /app
USER worker

EXPOSE 8080

# DO health check: worker must respond within start-period
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["python", "main.py"]

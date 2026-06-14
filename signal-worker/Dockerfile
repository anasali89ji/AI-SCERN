# AI-SCERN Detection Worker v4.0.0 — DigitalOcean App Platform Dockerfile
# Base: python:3.11-slim (Debian Trixie)
# Fix: libgl1-mesa-glx renamed to libgl1 in Debian Trixie
# Fix: libsm6/libxrender-dev not available — replaced with libgl1, libgles2
# Fix: libgtk-3-dev → libgtk-3-0 (runtime only, smaller image)

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ── System packages ───────────────────────────────────────────────────────────
# libgl1           → replaces libgl1-mesa-glx (renamed in Debian Trixie)
# libglib2.0-0     → OpenCV dependency
# libgles2         → OpenGL ES (replaces libxrender-dev for headless OpenCV)
# libxext6         → X11 extension library
# libgomp1         → OpenMP (numpy/scipy parallel ops)
# tesseract-ocr    → OCR engine
# tesseract-ocr-eng → English language data
# cmake            → needed to compile dlib (face-recognition)
# libopenblas-dev  → BLAS for numpy/scipy
# liblapack-dev    → LAPACK for scipy
# libx11-dev       → X11 headers (dlib dependency)
# build-essential  → gcc, g++, make
# python3-dev      → Python headers for C extensions
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

# Install Python dependencies (separate layer for Docker cache)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Ephemeral model cache dir
RUN mkdir -p /tmp/aiscern-models && chmod 777 /tmp/aiscern-models

# Non-root user
RUN useradd -m -u 1000 worker && chown -R worker:worker /app
USER worker

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["python", "main.py"]

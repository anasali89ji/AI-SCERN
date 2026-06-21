# ============================================================
# AI-SCERN Detection Worker v4.2.0 — basic-s tier (2GB RAM)
# DigitalOcean App Platform — multi-stage, production-ready
#
# Key changes from v4.0.0:
#   - Multi-stage build: build tools never reach the final image
#   - face-recognition/dlib REMOVED → OpenCV DNN face detector
#     (see forensics/face_deepfake.py) — this also means there is
#     NO native compilation step left at all (every remaining
#     dependency ships manylinux wheels), so the builder stage
#     installs no apt packages beyond what pip itself needs.
#   - torch 2.5.1 (smaller, faster CPU inference than 2.3.0)
#   - curl-based HEALTHCHECK instead of spawning a Python process
#   - gunicorn + uvicorn worker for graceful restarts/shutdown
# ============================================================

# ---------- BUILDER STAGE ----------
FROM python:3.11-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

# Install CPU-only torch FIRST (own layer — large, rarely changes)
RUN pip install --no-cache-dir --target=/build/wheels \
    torch==2.5.1 \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies (separate layer — invalidated only when
# requirements.txt changes, not on every code edit).
# NOTE: requirements.txt also lists torch==2.5.1 (so `pip install -r
# requirements.txt` works correctly for local/non-Docker dev). But pip
# installs with --target=/build/wheels are NOT on this interpreter's
# sys.path, so the second pip invocation below would not see the CPU
# wheel installed above as "already satisfied" and would silently
# re-download the full CUDA build (~900MB+) from default PyPI, overwriting
# the optimization above. Filter torch out of this specific install.
COPY requirements.txt .
RUN grep -v '^torch==' requirements.txt > requirements-docker.txt && \
    pip install --no-cache-dir --target=/build/wheels -r requirements-docker.txt

# ---------- RUNTIME STAGE ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV OPENCV_IO_ENABLE_OPENEXR=0
ENV PYTHONPATH=/app

# Runtime-only system packages — no compilers, no -dev headers
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgles2 \
    libxext6 \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-built dependencies from the builder stage
COPY --from=builder /build/wheels /usr/local/lib/python3.11/site-packages

# Copy application code (models/, engines/, analyzers/, forensics/, utils/, main.py)
COPY . .

# Ephemeral model cache (lazy-loaded ML models live here, never baked in)
RUN mkdir -p /tmp/aiscern-models && chmod 777 /tmp/aiscern-models

# Non-root user
RUN useradd -m -u 1000 worker && chown -R worker:worker /app
USER worker

EXPOSE 8080

# Lightweight health check using curl — a Python urllib subprocess was
# ~50-100MB of overhead per check on a 2GB instance at a 30s interval
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:8080/health > /dev/null || exit 1

# Gunicorn manages graceful shutdown, worker recycling, and restarts —
# a bare uvicorn process does not handle these well in production.
# Invoked via `python -m` rather than the bare `gunicorn` command: pip's
# --target install (builder stage) writes the console-script wrapper to
# site-packages/bin/, which is not on PATH after COPY --from=builder —
# `python -m gunicorn` only needs the package itself to be importable.
CMD ["python", "-m", "gunicorn", \
     "-w", "2", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8080", \
     "--timeout", "120", \
     "--keep-alive", "30", \
     "--max-requests", "500", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "main:app"]

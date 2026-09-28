# AISCERN Signal Worker

CPU-first (optional GPU) image/video/audio/text AI-detection backend, deployed
on DigitalOcean App Platform. See `docs/PHYSICAL_LAYERS.md` for the Phase 1+2
physics-based detection layers (L11-L14).

## Detection Layers (Image Engine)

| Layer | Name | Type |
|-------|------|------|
| L1  | Pixel Integrity (ELA)              | v2 CPU |
| L2  | DCT Compression Artifacts          | v2 CPU |
| L3  | Noise & Statistical Analysis       | v2 CPU |
| L4  | Frequency Domain Analysis          | v2 CPU |
| L5  | Diffusion Inversion                | GPU (optional) |
| L5b | Diffusion Snap-back                | GPU (optional) |
| L6  | Zero-Shot Entropy Detector (ZED)   | CPU |
| L7  | DIRE Approximation                 | CPU |
| L8  | NLM Noise Entropy Tensor           | CPU |
| L9  | Modern AI Fingerprint              | CPU |
| L10 | Generative Fingerprinting Engine   | CPU |
| L11 | PAFRA — Polarization & Fresnel     | CPU, physics |
| L12 | BDIS — Bayer Demosaicing           | CPU, physics |
| L13 | SSWDP — Subsurface Scattering      | CPU, physics |
| L14 | QESM — Quantum Efficiency Match    | CPU, physics |

Plus a parallel v3 forensic cascade (metadata, frequency, noise, texture,
color, illumination, face/deepfake, watermark, text-artifact detection) and
SynthID generator-fingerprint detection.

All CPU layers run concurrently via `ThreadPoolExecutor` in
`engines/image_engine.py`. Per-layer and v3-forensic scores are fused into a
single `composite_score` via `_fuse_scores()`, with override rules for
high-confidence generator detections.

## Running tests

```bash
pip install -r requirements.txt
pip install pytest --break-system-packages
pytest tests/
```

Note: most test modules import `fastapi.testclient`; install `fastapi` and
`httpx` (already in requirements.txt) to run the full suite, including
`tests/test_physical_layers.py` which also runs standalone with just
numpy/opencv/pillow/pytest.

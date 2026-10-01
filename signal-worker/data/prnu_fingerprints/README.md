# PRNU Fingerprint Database

This directory holds per-camera-model PRNU (Photo Response Non-Uniformity)
fingerprints used by `signal-worker/analyzers/prnu.py` (Layer 26).

## File format

Each `.npy` file is a 2D float32 array, 256×256, named `<camera_model>.npy`
(e.g. `iphone_14_pro.npy`, `canon_eos_r5.npy`).

The array is the *noise residual* of a flat-field photo taken by that
camera (lens cap on, low ISO, long exposure). The wavelet-denoise and
Wiener-filter pipeline in `prnu._extract_prnu` is the same one applied
to incoming images at analysis time — drop a flat-field photo's noise
residual here and it will work.

## How to generate a new fingerprint

```python
import numpy as np
from PIL import Image
from analyzers.prnu import _extract_prnu

# Load 10-50 flat-field photos taken by the same camera
flat_fields = [np.array(Image.open(f).convert("RGB")) for f in photos]

# Average their noise residuals — averaging suppresses random noise and
# isolates the systematic sensor pattern.
residuals = [_extract_prnu(img) for img in flat_fields]
fingerprint = np.mean(residuals, axis=0).astype(np.float32)

# Save with the camera's name (lowercase, underscores)
np.save("data/prnu_fingerprints/iphone_14_pro.npy", fingerprint)
```

## Initial state

This directory ships empty (only this README). The analyzer returns
`status="not_applicable"` when no fingerprints are present — it does not
fail or skew the fused score. Populate this directory with real camera
fingerprints to enable L26 in production.

## Recommended starter set

For an MVP, ship fingerprints for the 5-10 most common camera models
seen in your production traffic:

- iphone_13_pro.npy
- iphone_14_pro.npy
- iphone_15_pro.npy
- samsung_galaxy_s23.npy
- google_pixel_8.npy
- canon_eos_r5.npy
- sony_a7iv.npy
- nikon_z6.npy

(All names lowercase with underscores — the analyzer surfaces them in
the audit trail so users see "PRNU match with iphone_14_pro".)

## Reference

Lukas, Fridrich, Goljan — "Determining Digital Image Origin Using Sensor
Imperfections" (IEEE TIFS 2006). The PCE threshold of 60 used by this
analyzer comes from §IV.B of that paper.

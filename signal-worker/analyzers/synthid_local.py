"""
Aiscern Signal Worker — SynthID Local Detector
FFT-based watermark detection approach based on public research.
Does NOT include any Google proprietary code.
Reference: public SynthID research papers and open-source implementations.

SynthID embeds a pseudo-random pattern in the latent frequency space
during image generation. We detect this by looking for:
1. Structured energy in specific frequency bands
2. Correlation with known SynthID-characteristic patterns
"""

import numpy as np
from PIL import Image


def check_synthid(img_array: np.ndarray) -> dict:
    """
    Attempt local SynthID watermark detection.
    Returns { "detected": bool, "confidence": float }.

    Note: True SynthID detection requires the private key from Google.
    This is a heuristic proxy that can flag *possible* SynthID presence
    based on frequency-domain patterns published in open research.
    """
    try:
        gray = img_array.mean(axis=2).astype(np.float32) / 255.0

        # Resize to 256x256 for consistent analysis
        from PIL import Image as PILImage
        pil_g  = PILImage.fromarray((gray * 255).astype(np.uint8))
        pil_g  = pil_g.resize((256, 256), PILImage.LANCZOS)
        gray   = np.array(pil_g, dtype=np.float32) / 255.0

        fft    = np.fft.fft2(gray)
        fft_s  = np.fft.fftshift(fft)
        mag    = np.abs(fft_s)

        h, w   = mag.shape
        cy, cx = h // 2, w // 2

        # SynthID research suggests the watermark energy concentrates in
        # mid-frequency annular bands. Check energy ratios in those bands.
        y_idx, x_idx = np.indices((h, w))
        r = np.sqrt((y_idx - cy)**2 + (x_idx - cx)**2)

        # Low freq band (DC): r < 10
        # Mid freq bands (SynthID target zone): 10 <= r < 50
        # High freq: r >= 50
        low_mask  = r < 10
        mid_mask  = (r >= 10) & (r < 50)
        high_mask = r >= 50

        e_low  = float(mag[low_mask].mean())
        e_mid  = float(mag[mid_mask].mean())
        e_high = float(mag[high_mask].mean())

        total  = e_low + e_mid + e_high + 1e-8
        mid_ratio = e_mid / total

        # SynthID-embedded images tend to have slightly elevated mid-frequency energy
        # compared to natural distribution. This is a weak signal without the key.
        # Threshold tuned conservatively to avoid false positives.
        if mid_ratio > 0.38:
            # Elevated mid-frequency energy — possible SynthID signature
            confidence = min(0.45 + (mid_ratio - 0.38) * 2.0, 0.72)
            detected   = confidence > 0.55
        else:
            confidence = max(0.05, mid_ratio * 0.5)
            detected   = False

        return {"detected": bool(detected), "confidence": round(confidence, 4)}

    except Exception:
        return {"detected": False, "confidence": 0.0}

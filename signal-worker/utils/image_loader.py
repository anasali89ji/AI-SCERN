"""
Aiscern Signal Worker — Image Loader
Downloads an image from a URL, validates it, and returns both
a numpy array (for signal analysis) and a PIL Image (for EXIF, metadata).
"""

import io
import httpx
import numpy as np
from PIL import Image, UnidentifiedImageError
from typing import Tuple

MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP"}
TIMEOUT_SECONDS = 15.0


async def load_image_from_url(url: str) -> Tuple[np.ndarray, Image.Image]:
    """
    Download image from URL and return (numpy_array, pil_image).
    numpy_array is RGB uint8 [H, W, 3].
    Raises ValueError or RuntimeError on failure.
    """
    if not url.startswith(("http://", "https://")):
        raise ValueError(f"Invalid URL scheme: {url[:20]}")

    async with httpx.AsyncClient(follow_redirects=True, timeout=TIMEOUT_SECONDS) as client:
        response = await client.get(url, headers={"User-Agent": "Aiscern-SignalWorker/1.0"})
        response.raise_for_status()

    content = response.content
    if len(content) > MAX_SIZE_BYTES:
        raise ValueError(f"Image too large: {len(content) / 1024 / 1024:.1f}MB (max 10MB)")

    try:
        pil_image = Image.open(io.BytesIO(content))
        pil_image.verify()  # Check for corruption
        # Reload after verify (verify closes the file-like object)
        pil_image = Image.open(io.BytesIO(content))
    except (UnidentifiedImageError, Exception) as e:
        raise ValueError(f"Cannot decode image: {e}")

    if pil_image.format not in ALLOWED_FORMATS:
        raise ValueError(f"Unsupported format: {pil_image.format}")

    # Convert to RGB numpy array (handle RGBA, P, L modes)
    pil_rgb = pil_image.convert("RGB")
    arr     = np.array(pil_rgb, dtype=np.uint8)

    if arr.ndim != 3 or arr.shape[2] != 3:
        raise RuntimeError(f"Unexpected array shape: {arr.shape}")

    return arr, pil_image

"""
Aiscern Signal Worker — Image Loader
Downloads an image from a URL, validates it, and returns both
a numpy array (for signal analysis) and a PIL Image (for EXIF, metadata).

SSRF protection (BUG-3):
  A bare scheme check (http/https only) is NOT sufficient — an attacker can
  still point imageUrl at http://169.254.169.254/ (cloud instance metadata),
  http://localhost:6379/ (internal services), or an RFC1918 address to probe
  the internal network. We additionally:
    1. Resolve the hostname ourselves and reject any resolved IP that is
       private, loopback, link-local, reserved, or multicast.
    2. Disable httpx's automatic redirect-following and instead follow
       redirects manually (capped), re-validating the target host on every
       hop — a 200-OK initial host with a 302 to an internal IP would
       otherwise bypass the check entirely.
"""

import io
import socket
import ipaddress
import asyncio
import httpx
import numpy as np
from PIL import Image, UnidentifiedImageError
from typing import Tuple, Optional
from urllib.parse import urlsplit

MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP"}
TIMEOUT_SECONDS = 15.0
MAX_REDIRECTS = 5
ALLOWED_SCHEMES = {"http", "https"}


# ── Shared httpx client (P2: connection pool reuse) ─────────────────────────
# A fresh httpx.AsyncClient() per request means a new TCP connection (+ TLS
# handshake for https) on every single image download — pure overhead when
# the same source domains (e.g. the platform's own CDN/storage bucket) are
# hit repeatedly. A single shared client with a bounded connection pool
# reuses keep-alive connections across requests instead.
_client: Optional[httpx.AsyncClient] = None
_client_lock = asyncio.Lock()


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is not None and not _client.is_closed:
        return _client
    async with _client_lock:
        # Re-check after acquiring the lock — another coroutine may have
        # already created it while we were waiting.
        if _client is None or _client.is_closed:
            _client = httpx.AsyncClient(
                follow_redirects=False,  # SSRF: redirects are followed manually below, with re-validation
                timeout=TIMEOUT_SECONDS,
                limits=httpx.Limits(
                    max_connections=50,
                    max_keepalive_connections=20,
                    keepalive_expiry=30.0,
                ),
            )
        return _client


async def close_client() -> None:
    """Call on app shutdown to release pooled connections cleanly."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


def _is_blocked_ip(ip_str: str) -> bool:
    """True if the IP must never be reachable from the signal worker."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # unparsable → fail closed
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local      # covers 169.254.0.0/16 — cloud metadata (AWS/GCP/Azure/DO all use 169.254.169.254)
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _resolve_host_blocking(hostname: str) -> list:
    """Blocking DNS resolution — call via asyncio.to_thread."""
    infos = socket.getaddrinfo(hostname, None)
    return [info[4][0] for info in infos]


async def _validate_url(url: str) -> str:
    """
    Validate scheme + resolve host, rejecting any URL whose hostname
    resolves (even partially) to a blocked IP range.
    Returns the hostname for logging/debugging purposes.
    """
    parts = urlsplit(url)

    if parts.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Invalid URL scheme: {parts.scheme!r}")

    if not parts.hostname:
        raise ValueError("URL has no hostname")

    if parts.username or parts.password:
        raise ValueError("URLs with embedded credentials are not allowed")

    hostname = parts.hostname

    # A bare IP literal in the URL — validate directly, no DNS needed.
    try:
        ipaddress.ip_address(hostname)
        if _is_blocked_ip(hostname):
            raise ValueError(f"Blocked IP address: {hostname}")
        return hostname
    except ValueError as e:
        if "Blocked IP" in str(e):
            raise
        # Not a literal IP — fall through to DNS resolution below.

    try:
        resolved_ips = await asyncio.to_thread(_resolve_host_blocking, hostname)
    except socket.gaierror as e:
        raise ValueError(f"DNS resolution failed for {hostname}: {e}")

    if not resolved_ips:
        raise ValueError(f"No addresses resolved for {hostname}")

    for ip in resolved_ips:
        if _is_blocked_ip(ip):
            raise ValueError(f"Hostname {hostname} resolves to a blocked address ({ip})")

    return hostname


async def load_image_from_url(url: str) -> Tuple[np.ndarray, Image.Image]:
    """
    Download image from URL and return (numpy_array, pil_image).
    numpy_array is RGB uint8 [H, W, 3].
    Raises ValueError or RuntimeError on failure.
    """
    await _validate_url(url)

    client = await _get_client()
    current_url = url
    response = None
    for _ in range(MAX_REDIRECTS + 1):
        response = await client.get(current_url, headers={"User-Agent": "Aiscern-SignalWorker/1.0"})
        if response.is_redirect:
            next_url = response.headers.get("location")
            if not next_url:
                raise ValueError("Redirect response missing Location header")
            # Resolve relative redirects against the current URL, then re-validate the new host
            next_url = str(httpx.URL(current_url).join(next_url))
            await _validate_url(next_url)
            current_url = next_url
            continue
        break
    else:
        raise ValueError(f"Too many redirects (max {MAX_REDIRECTS})")

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

"""
Aiscern Detection Worker — Lazy Model Cache
Lazy loading with memory management for DigitalOcean App Platform.
DO instances have limited RAM (512MB–2GB) — never load models at import time.

BUG-5: GPU layers (L5 diffusion_inversion, L5b diffusion_snapback) used to
keep their own separate, never-evicted module-level globals (_cached_model,
_pipe_cache) — loaded once per worker process and held in VRAM forever, with
no thread lock and no way to free memory under pressure on shared GPU
instances. Both now route through this shared cache instead, which adds
last-access tracking and evict_idle_models() to unload anything that's sat
idle past a TTL (e.g. call periodically from a background task).
"""

import gc
import sys
import time
import threading
import logging
from typing import Any, Callable, Dict, List

logger = logging.getLogger(__name__)

_model_cache: Dict[str, Any] = {}
_last_access: Dict[str, float] = {}
# BUG-6: concurrent requests hitting get_model() for the same uncached key
# could each pass the "if key in _model_cache" check before either had
# finished loading, triggering a double-load (e.g. two copies of a torch
# model in memory at once) and risking OOM on 1-2GB instances.
_cache_lock = threading.RLock()


def get_model(key: str, loader_fn: Callable, *args: Any, **kwargs: Any) -> Any:
    """Get a cached model, or load and cache it on first call. Thread-safe."""
    with _cache_lock:
        if key in _model_cache:
            logger.debug("[ModelCache] Cache hit: %s", key)
            _last_access[key] = time.time()
            return _model_cache[key]

        logger.info("[ModelCache] Loading model: %s", key)
        try:
            model = loader_fn(*args, **kwargs)
            _model_cache[key] = model
            _last_access[key] = time.time()
            usage = get_memory_usage()
            logger.info("[ModelCache] Loaded %s | RSS: %.1fMB", key, usage["rss_mb"])
            return model
        except Exception as e:
            logger.error("[ModelCache] Failed to load %s: %s", key, e)
            raise


def clear_model(key: str) -> None:
    """Remove a specific model from cache and free memory."""
    with _cache_lock:
        if key in _model_cache:
            del _model_cache[key]
            _last_access.pop(key, None)
            gc.collect()
            logger.info("[ModelCache] Cleared: %s", key)


def evict_idle_models(ttl_seconds: float = 300.0) -> List[str]:
    """
    Evict any cached model that hasn't been accessed (via get_model) in the
    last `ttl_seconds` — default 5 minutes. Intended for GPU model entries
    (diffusion_inversion, diffusion_snapback) on shared/VRAM-constrained
    instances; CPU-only entries are cheap enough that eviction matters less,
    but the TTL applies uniformly since there's no per-entry "GPU vs CPU"
    flag to special-case on.

    Returns the list of evicted keys (empty if nothing was idle).
    """
    with _cache_lock:
        now = time.time()
        idle_keys = [k for k, last in _last_access.items() if now - last > ttl_seconds]
        for k in idle_keys:
            del _model_cache[k]
            del _last_access[k]
        if idle_keys:
            gc.collect()
            if "torch" in sys.modules:
                try:
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass
            logger.info("[ModelCache] Evicted %d idle model(s) (TTL=%.0fs): %s",
                        len(idle_keys), ttl_seconds, idle_keys)
        return idle_keys


def clear_all_models() -> None:
    """Clear all cached models. Call on shutdown or memory pressure."""
    global _model_cache
    with _cache_lock:
        count = len(_model_cache)
        _model_cache.clear()
        _last_access.clear()
    gc.collect()
    if "torch" in sys.modules:
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
    logger.info("[ModelCache] Cleared %d models", count)


def get_memory_usage() -> Dict[str, float]:
    """Return current process memory stats in MB."""
    try:
        import psutil
        proc = psutil.Process()
        mem = proc.memory_info()
        return {
            "rss_mb": round(mem.rss / 1024 / 1024, 2),
            "vms_mb": round(mem.vms / 1024 / 1024, 2),
            "percent": round(proc.memory_percent(), 2),
        }
    except Exception:
        return {"rss_mb": 0.0, "vms_mb": 0.0, "percent": 0.0}


def cache_info() -> Dict[str, Any]:
    """Return cache state for health checks."""
    with _cache_lock:
        now = time.time()
        return {
            "cached_models": list(_model_cache.keys()),
            "model_count": len(_model_cache),
            "idle_seconds": {k: round(now - t, 1) for k, t in _last_access.items()},
            "memory": get_memory_usage(),
        }

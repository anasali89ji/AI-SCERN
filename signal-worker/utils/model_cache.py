"""
Aiscern Detection Worker — Lazy Model Cache
Lazy loading with memory management for DigitalOcean App Platform.
DO instances have limited RAM (512MB–2GB) — never load models at import time.
"""

import gc
import sys
import logging
from typing import Any, Callable, Dict

logger = logging.getLogger(__name__)

_model_cache: Dict[str, Any] = {}


def get_model(key: str, loader_fn: Callable, *args: Any, **kwargs: Any) -> Any:
    """Get a cached model, or load and cache it on first call."""
    if key in _model_cache:
        logger.debug("[ModelCache] Cache hit: %s", key)
        return _model_cache[key]

    logger.info("[ModelCache] Loading model: %s", key)
    try:
        model = loader_fn(*args, **kwargs)
        _model_cache[key] = model
        usage = get_memory_usage()
        logger.info("[ModelCache] Loaded %s | RSS: %.1fMB", key, usage["rss_mb"])
        return model
    except Exception as e:
        logger.error("[ModelCache] Failed to load %s: %s", key, e)
        raise


def clear_model(key: str) -> None:
    """Remove a specific model from cache and free memory."""
    if key in _model_cache:
        del _model_cache[key]
        gc.collect()
        logger.info("[ModelCache] Cleared: %s", key)


def clear_all_models() -> None:
    """Clear all cached models. Call on shutdown or memory pressure."""
    global _model_cache
    count = len(_model_cache)
    _model_cache.clear()
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
    return {
        "cached_models": list(_model_cache.keys()),
        "model_count": len(_model_cache),
        "memory": get_memory_usage(),
    }

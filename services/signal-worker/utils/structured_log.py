"""
utils/structured_log.py — Structured JSON logging for Aiscern signal-worker.

DigitalOcean App Platform captures stdout/stderr; DO's log aggregation can parse
structured JSON lines if the format is consistent. This module wraps Python's
standard logger with a JSON formatter and provides convenience functions
that emit standardised log records with well-known fields:

  job_id     — request / job identifier
  engine     — which engine is running ("image", "text", "batch")
  layer      — numeric layer (L1-L8) or None
  latency_ms — elapsed milliseconds for the operation
  score      — suspicion score emitted by the layer / engine
  event      — short event name (start, complete, error, cache_hit, …)

Usage
-----
    from utils.structured_log import slog

    slog.layer_complete(job_id="abc", engine="image", layer=6,
                        latency_ms=42, score=0.76)
    slog.engine_complete(job_id="abc", engine="image", latency_ms=310,
                         score=0.61)
    slog.error(job_id="abc", engine="image", layer=2, exc=e)
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("aiscern.structured")

# ── JSON log formatter ─────────────────────────────────────────────────────────

class _JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts":      datetime.now(timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }
        # Merge any extra fields attached to the record
        for key, val in record.__dict__.items():
            if key.startswith("_sl_"):
                payload[key[4:]] = val
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def _setup_json_logger() -> logging.Logger:
    _logger = logging.getLogger("aiscern.structured")
    _logger.setLevel(logging.DEBUG)  # capture all levels; handlers filter downstream
    if not _logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(_JSONFormatter())
        _logger.addHandler(handler)
        _logger.propagate = False  # don't double-emit to root logger
    return _logger


_json_logger = _setup_json_logger()


# ── public helpers ─────────────────────────────────────────────────────────────

class _SLog:
    """Thin wrapper that emits structured JSON log lines."""

    def _emit(self, level: int, event: str, **fields) -> None:
        extra = {f"_sl_{k}": v for k, v in fields.items() if v is not None}
        extra["_sl_event"] = event
        _json_logger.log(level, event, extra=extra)

    # ── Engine lifecycle ───────────────────────────────────────────────────────

    def engine_start(self, job_id: str, engine: str, **kw) -> None:
        self._emit(logging.INFO, "engine_start", job_id=job_id, engine=engine, **kw)

    def engine_complete(
        self,
        job_id: str,
        engine: str,
        latency_ms: int,
        score: Optional[float] = None,
        **kw,
    ) -> None:
        self._emit(
            logging.INFO,
            "engine_complete",
            job_id=job_id,
            engine=engine,
            latency_ms=latency_ms,
            score=score,
            **kw,
        )

    # ── Layer lifecycle ────────────────────────────────────────────────────────

    def layer_start(self, job_id: str, engine: str, layer: int, **kw) -> None:
        self._emit(logging.DEBUG, "layer_start", job_id=job_id, engine=engine, layer=layer, **kw)

    def layer_complete(
        self,
        job_id: str,
        engine: str,
        layer: int,
        latency_ms: int,
        score: Optional[float] = None,
        status: str = "success",
        **kw,
    ) -> None:
        self._emit(
            logging.INFO,
            "layer_complete",
            job_id=job_id,
            engine=engine,
            layer=layer,
            latency_ms=latency_ms,
            score=score,
            status=status,
            **kw,
        )

    # ── Error ──────────────────────────────────────────────────────────────────

    def error(
        self,
        job_id: str,
        engine: str,
        layer: Optional[int] = None,
        exc: Optional[Exception] = None,
        **kw,
    ) -> None:
        extra = {f"_sl_{k}": v for k, v in kw.items() if v is not None}
        extra["_sl_event"]  = "error"
        extra["_sl_job_id"] = job_id
        extra["_sl_engine"] = engine
        if layer is not None:
            extra["_sl_layer"] = layer
        if exc is not None:
            extra["_sl_exc_type"] = type(exc).__name__
            extra["_sl_exc_msg"]  = str(exc)
        _json_logger.error("error", extra=extra)

    # ── Cache events ───────────────────────────────────────────────────────────

    def cache_hit(self, key: str, **kw) -> None:
        self._emit(logging.DEBUG, "cache_hit", cache_key=key, **kw)

    def cache_miss(self, key: str, **kw) -> None:
        self._emit(logging.DEBUG, "cache_miss", cache_key=key, **kw)

    def cache_evict(self, keys: list, reason: str = "ttl", **kw) -> None:
        self._emit(logging.INFO, "cache_evict", evicted_keys=keys, reason=reason, **kw)

    # ── Rate limiting ──────────────────────────────────────────────────────────

    def rate_limited(self, client_ip: str, path: str, **kw) -> None:
        self._emit(logging.WARNING, "rate_limited", client_ip=client_ip, path=path, **kw)


# Singleton
slog = _SLog()

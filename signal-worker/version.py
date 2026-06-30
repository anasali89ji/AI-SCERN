"""
Aiscern Detection Worker — single source of truth for the service version.
Import VERSION everywhere instead of hardcoding version strings, so
main.py, the engines, and health checks never drift out of sync again.
(Fixes BUG-7: image_engine.py returned "4.0.0" from one path and "4.1.0"
from another.)
"""

VERSION = "4.4.0"

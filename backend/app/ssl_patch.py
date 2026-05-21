"""
SSL verification bypass for corporate proxy (CrowdStrike TLS inspection).

The Docker container doesn't have the corporate CA cert in its trust store,
so ALL outbound HTTPS calls fail. This module patches:
  - ssl module  → urllib / requests
  - httpx       → Supabase, Groq, CascadeFlow
  - aiohttp     → Hindsight (handled separately via configuration.verify_ssl)

Import this module FIRST in main.py and any standalone scripts.
"""
import ssl
import warnings

import httpx

# ── urllib / requests ─────────────────────────────────────────────────────────
ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore[attr-defined]

# ── httpx (sync + async) ─────────────────────────────────────────────────────
_orig_sync = httpx.Client.__init__
_orig_async = httpx.AsyncClient.__init__


def _patched_sync(self, *args, **kwargs):
    kwargs["verify"] = False  # force-override — corp proxy intercepts TLS
    _orig_sync(self, *args, **kwargs)


def _patched_async(self, *args, **kwargs):
    kwargs["verify"] = False  # force-override
    _orig_async(self, *args, **kwargs)


httpx.Client.__init__ = _patched_sync          # type: ignore[method-assign]
httpx.AsyncClient.__init__ = _patched_async    # type: ignore[method-assign]

warnings.filterwarnings("ignore", message=".*ssl.*", category=DeprecationWarning)

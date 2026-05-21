import asyncio
import logging
import os

import app.ssl_patch  # noqa: F401 — must be first; disables SSL verify for corp proxy

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.api.routes import router
from app.infrastructure.supabase import init_supabase
from app.infrastructure.hindsight import init_memory_bank

settings = get_settings()

app = FastAPI(
    title="ContentOS API",
    description="AI-native Creator Operating System — transforms long-form content into platform-native derivatives",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

# Serve extracted clip files
_clips_dir = settings.clip_storage_path
os.makedirs(_clips_dir, exist_ok=True)
app.mount("/api/clips", StaticFiles(directory=_clips_dir), name="clips")

logger = logging.getLogger("contentos")


def _handle_async_exception(loop: asyncio.AbstractEventLoop, context: dict) -> None:
    """Suppress non-critical background task SSL errors (e.g. hindsight _acreate_bank)."""
    exc = context.get("exception")
    msg = str(exc) if exc else context.get("message", "")
    if "SSL" in msg or "ssl" in msg or "certificate" in msg.lower():
        logger.debug("Suppressed background SSL error: %s", msg)
        return
    loop.default_exception_handler(context)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize external services on startup."""
    asyncio.get_event_loop().set_exception_handler(_handle_async_exception)
    await init_supabase()
    await init_memory_bank()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "contentos-api"}

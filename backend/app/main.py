from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import router
from app.infrastructure.supabase import init_supabase
from app.infrastructure.hindsight import init_memory_bank

settings = get_settings()

app = FastAPI(
    title="ContentOS API",
    description="AI-native Creator Operating System — transforms long-form content into platform-native derivatives",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize external services on startup."""
    await init_supabase()
    await init_memory_bank()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "contentos-api"}

"""Hindsight memory client — recall, reflect, retain."""
from __future__ import annotations

from typing import Any

from hindsight_client import Hindsight

from app.config import get_settings

_client: Hindsight | None = None

BANK_BACKGROUND = (
    "A creator intelligence memory system. Tracks how a content creator "
    "communicates, what hook styles they prefer, how they edit AI outputs, "
    "and what content patterns resonate with their voice. Used to personalise "
    "future content generation to sound authentically like the creator."
)

BANK_DISPOSITION = {
    "skepticism": 3,
    "literalism": 4,
    "empathy": 3,
}


def _get_client() -> Hindsight:
    if _client is None:
        raise RuntimeError("Hindsight client not initialised")
    return _client


async def init_memory_bank() -> None:
    global _client
    settings = get_settings()
    if not settings.hindsight_base_url or not settings.hindsight_api_key:
        print("⚠️  Hindsight not configured — running without memory")
        return

    _client = Hindsight(
        base_url=settings.hindsight_base_url,
        api_key=settings.hindsight_api_key,
    )

    # Idempotent bank initialisation
    bank_id = settings.hindsight_bank_id
    try:
        _client.create_bank(
            bank_id=bank_id,
            name="ContentOS Creator Memory",
            background=BANK_BACKGROUND,
            disposition_skepticism=BANK_DISPOSITION["skepticism"],
            disposition_literalism=BANK_DISPOSITION["literalism"],
            disposition_empathy=BANK_DISPOSITION["empathy"],
        )
        print(f"✅ Hindsight bank '{bank_id}' created")
    except Exception:
        print(f"✅ Hindsight bank '{bank_id}' already exists")


def recall_memories(query: str) -> dict[str, Any]:
    """Pull raw memories relevant to a query. Returns display-ready dict."""
    settings = get_settings()
    if _client is None:
        return {"recall_count": 0, "recall_items": [], "available": False}

    response = _get_client().recall(
        bank_id=settings.hindsight_bank_id,
        query=query,
        budget="mid",
    )
    items = [r.text for r in response.results] if response.results else []
    return {
        "recall_count": len(items),
        "recall_items": items,
        "available": True,
    }


def reflect_on_creator(query: str) -> str:
    """Synthesise a compact reflection to inject into generation prompts."""
    settings = get_settings()
    if _client is None:
        return ""

    response = _get_client().reflect(
        bank_id=settings.hindsight_bank_id,
        query=query,
        budget="low",
    )
    return response.text if response else ""


def retain_observation(observation: str, tags: list[str] | None = None) -> None:
    """Store a single observation about the creator's editing behaviour."""
    settings = get_settings()
    if _client is None:
        return

    _get_client().retain(
        bank_id=settings.hindsight_bank_id,
        content=observation,
        tags=tags or ["editing-behaviour"],
        context="Derived from creator's review session editing behaviour",
    )

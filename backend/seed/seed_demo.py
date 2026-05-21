"""
Demo seed script — pre-populate Hindsight with realistic creator observations
so the second video in the demo immediately shows persona-adapted outputs.

Usage (from backend/ with .venv activated OR inside the Docker container):
  python seed/seed_demo.py

Set HINDSIGHT_BASE_URL and HINDSIGHT_API_KEY in .env before running.
"""
import os
import ssl
import sys
from pathlib import Path

# Allow running from repo root or backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Disable SSL verification before importing any HTTP clients (corp proxy)
ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore
import httpx as _httpx
_orig_sync = _httpx.Client.__init__
_orig_async = _httpx.AsyncClient.__init__
def _ps(self, *a, **kw): kw["verify"] = False; _orig_sync(self, *a, **kw)
def _pa(self, *a, **kw): kw["verify"] = False; _orig_async(self, *a, **kw)
_httpx.Client.__init__ = _ps  # type: ignore
_httpx.AsyncClient.__init__ = _pa  # type: ignore

from hindsight_client import Hindsight

BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "orbitos-demo")
BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "")
API_KEY = os.getenv("HINDSIGHT_API_KEY", "")

SEED_OBSERVATIONS = [
    # Hook style — strong positive signal
    "Creator always approves hooks that open with a question: 'What if...', 'Why does...', 'Have you ever...' — keeps them unchanged every time.",
    "Creator approves hooks that state a counterintuitive fact or contrarian claim in the first line.",
    # Hook style — strong negative signal
    "Creator rejects every hook that begins with an imperative like 'Stop doing X', 'You need to X', or 'Do this instead'.",
    "Creator has rejected every hook starting with 'In this video', 'Today I want to', or 'Let me show you'.",
    # Length preferences
    "Creator shortens AI-generated captions to under 120 characters by cutting trailing explanation — the punchline must land in the first sentence.",
    "Creator removes filler words 'basically', 'essentially', 'actually', and 'simply' from every draft without exception.",
    # Tone preferences
    "Creator consistently rewrites passive constructions to active first-person: 'It can be seen that...' → 'I've noticed...'",
    "Creator prefers a conversational, direct tone — rejects formal or corporate language and edits out phrases like 'leverage', 'synergize', 'deep dive'.",
    # Platform-specific
    "Creator approves LinkedIn posts that open with a specific data point or personal anecdote, not a generic observation.",
    "Creator regenerates Instagram Reels captions that use generic hashtags like #content or #tips — prefers niche, topic-specific tags.",
]

SEED_TAGS = ["editing-behaviour", "event:seed", "seed"]


def main() -> None:
    if not BASE_URL or not API_KEY:
        print("Error: HINDSIGHT_BASE_URL and HINDSIGHT_API_KEY must be set in .env")
        sys.exit(1)

    client = Hindsight(base_url=BASE_URL, api_key=API_KEY)
    # Disable SSL verification for corporate proxy (CrowdStrike TLS inspection)
    client._api_client.configuration.verify_ssl = False

    # Ensure bank exists
    try:
        client.create_bank(
            bank_id=BANK_ID,
            name="OrbitOS Creator Memory",
            background=(
                "A creator persona memory system. Tracks how a YouTube long-form creator "
                "communicates, what hook styles they prefer, how they edit AI outputs, "
                "and what short-form content patterns match their persona."
            ),
        )
        print(f"Created bank: {BANK_ID}")
    except Exception:
        print(f"Bank '{BANK_ID}' already exists — adding observations")

    for obs in SEED_OBSERVATIONS:
        client.retain(
            bank_id=BANK_ID,
            content=obs,
            tags=SEED_TAGS,
            context="Pre-seeded for OrbitOS demo",
        )
        print(f"  + {obs[:80]}...")

    print(f"\nSeeded {len(SEED_OBSERVATIONS)} observations into bank '{BANK_ID}'")
    print("Run a second video through the pipeline to see persona-adapted outputs.")


if __name__ == "__main__":
    main()

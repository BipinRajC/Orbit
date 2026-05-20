"""
Demo seed script — pre-populate Hindsight with realistic creator observations
so the second video in the demo immediately shows memory-adapted outputs.

Usage (from backend/ with .venv activated OR inside the Docker container):
  python seed/seed_demo.py

Set HINDSIGHT_BASE_URL and HINDSIGHT_API_KEY in .env before running.
"""
import os
import sys
from pathlib import Path

# Allow running from repo root or backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from hindsight_client import Hindsight

BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "contentos-demo")
BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "")
API_KEY = os.getenv("HINDSIGHT_API_KEY", "")

SEED_OBSERVATIONS = [
    "Creator consistently shortens AI-generated tweets by 30-50 characters, removing filler phrases.",
    "Creator approves question-style hooks (e.g. 'What if...', 'Why does...') at a high rate.",
    "Creator rejects hooks that use aggressive clickbait framing or superlative claims.",
    "Creator prefers direct, first-person statements over passive or third-person constructions.",
    "Creator removes filler words like 'basically', 'essentially', and 'actually' when editing.",
    "Creator favours punchy, standalone tweets that don't require the video for context.",
    "Creator's tone is conversational and direct — not formal, not overly casual.",
    "Creator has rejected all hooks that begin with 'In this video...' or 'Today we discuss...'",
]


def main() -> None:
    if not BASE_URL or not API_KEY:
        print("Error: HINDSIGHT_BASE_URL and HINDSIGHT_API_KEY must be set in .env")
        sys.exit(1)

    client = Hindsight(base_url=BASE_URL, api_key=API_KEY)

    # Ensure bank exists
    try:
        client.create_bank(
            bank_id=BANK_ID,
            name="ContentOS Creator Memory",
            background=(
                "A creator intelligence memory system. Tracks how a content creator "
                "communicates, what hook styles they prefer, how they edit AI outputs, "
                "and what content patterns resonate with their voice."
            ),
        )
        print(f"Created bank: {BANK_ID}")
    except Exception:
        print(f"Bank '{BANK_ID}' already exists — adding observations")

    for obs in SEED_OBSERVATIONS:
        client.retain(
            bank_id=BANK_ID,
            content=obs,
            tags=["editing-behaviour", "seed"],
            context="Pre-seeded for ContentOS hackathon demo",
        )
        print(f"  + {obs[:80]}...")

    print(f"\nSeeded {len(SEED_OBSERVATIONS)} observations into bank '{BANK_ID}'")
    print("Run a second video through the pipeline to see memory-adapted outputs.")


if __name__ == "__main__":
    main()

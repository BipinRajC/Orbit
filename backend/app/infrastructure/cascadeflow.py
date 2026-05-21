"""cascadeflow CascadeAgent setup and per-task helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from cascadeflow import CascadeAgent, ModelConfig

from app.config import get_settings


@dataclass
class CostAccumulator:
    """Tracks cumulative cost across a pipeline run."""
    total_calls: int = 0
    drafter_calls: int = 0
    verifier_calls: int = 0
    total_cost_usd: float = 0.0

    def record(self, result: Any) -> None:
        self.total_calls += 1
        model_used: str = getattr(result, "model_used", "") or ""
        cost: float = getattr(result, "total_cost", 0.0) or 0.0
        self.total_cost_usd += cost
        settings = get_settings()
        if settings.cascade_drafter_model in model_used:
            self.drafter_calls += 1
        else:
            self.verifier_calls += 1

    def to_dict(self) -> dict[str, Any]:
        drafter_pct = (
            round(self.drafter_calls / self.total_calls * 100)
            if self.total_calls else 0
        )
        # Estimate cost if all calls went to expensive model
        per_call_expensive = 0.0001
        hypothetical = self.total_calls * per_call_expensive
        savings = max(0.0, hypothetical - self.total_cost_usd)
        return {
            "total_calls": self.total_calls,
            "drafter_calls": self.drafter_calls,
            "verifier_calls": self.verifier_calls,
            "drafter_pct": drafter_pct,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "estimated_savings_usd": round(savings, 6),
        }


def _make_model_config(name: str, api_key: str) -> ModelConfig:
    return ModelConfig(
        name=name,
        provider="groq",
        api_key=api_key,
    )


def build_agent(quality_threshold: float = 0.7) -> CascadeAgent:
    """Build a CascadeAgent with drafter + verifier models."""
    settings = get_settings()
    return CascadeAgent(
        models=[
            _make_model_config(settings.cascade_drafter_model, settings.groq_api_key),
            _make_model_config(settings.cascade_verifier_model, settings.groq_api_key),
        ],
        quality={"threshold": quality_threshold},
    )


def get_extraction_agent() -> CascadeAgent:
    """Higher quality — moment extraction needs accuracy."""
    return build_agent(quality_threshold=0.8)


def get_generation_agent() -> CascadeAgent:
    """Lower threshold — drafter handles most generation cheaply."""
    return build_agent(quality_threshold=0.65)


def get_synthesis_agent() -> CascadeAgent:
    """Synthesis uses drafter only — observations are simple text."""
    return build_agent(quality_threshold=0.5)


async def run_prompt(
    agent: CascadeAgent,
    system: str,
    user: str,
    cost_acc: CostAccumulator | None = None,
) -> str:
    """
    Run a system + user prompt through cascadeflow.

    Passes messages as a list (cascadeflow treats a list query as messages).
    max_tokens set high enough for full content generation.
    """
    result = await agent.run(
        query=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=1024,
        temperature=0.7,
    )
    if cost_acc is not None:
        cost_acc.record(result)
    return result.content or ""

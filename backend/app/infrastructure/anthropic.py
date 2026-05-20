"""Anthropic SDK client and structured output helpers."""
from __future__ import annotations

import json
from typing import Any

import anthropic

from app.config import get_settings

# Model IDs
HAIKU_MODEL = "claude-haiku-4-5"
SONNET_MODEL = "claude-sonnet-4-5"

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        settings = get_settings()
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def structured_call(
    model: str,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, Any],
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> dict[str, Any]:
    """
    Call Claude with a tool definition to enforce structured JSON output.
    Returns the tool_use input dict (guaranteed valid against input_schema).
    """
    client = get_client()

    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
        tools=[
            {
                "name": tool_name,
                "description": tool_description,
                "input_schema": input_schema,
            }
        ],
        tool_choice={"type": "tool", "name": tool_name},
    )

    # Extract tool_use result
    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input  # type: ignore[return-value]

    raise ValueError(f"Claude did not return a tool_use block for {tool_name}")


async def text_call(
    model: str,
    system: str,
    user: str,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> str:
    """Simple text-mode Claude call. Returns the text response."""
    client = get_client()

    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    for block in response.content:
        if block.type == "text":
            return block.text

    return ""


def estimate_cost(
    input_tokens: int,
    output_tokens: int,
    model: str,
) -> float:
    """Rough cost estimate in USD based on public Anthropic pricing."""
    pricing = {
        HAIKU_MODEL: (0.00025 / 1000, 0.00125 / 1000),   # $0.25/$1.25 per 1M
        SONNET_MODEL: (0.003 / 1000, 0.015 / 1000),       # $3/$15 per 1M
    }
    in_rate, out_rate = pricing.get(model, (0.003 / 1000, 0.015 / 1000))
    return input_tokens * in_rate + output_tokens * out_rate

"""Canonical tag taxonomy for Hindsight memory.

Every retain_observation MUST use tags from these enums for filtering
to work. Use build_tags() to compose tag lists.
"""

# Persona / content style
STYLES = [
    "humour", "wit", "storytelling", "informational", "educational",
    "personal", "hot-take", "tutorial", "inspirational", "commentary",
    "deadpan", "hype-energy",
]

# Creator intent for a given video / clip
INTENTS = ["grow", "inspire", "teach", "trust", "entertain"]

# Output platforms (must match Platform enum in frontend)
PLATFORMS = ["instagram_reels", "youtube_shorts", "tiktok", "linkedin"]

# Deliverable section types (for per-section regenerate observations)
CONTENT_TYPES = [
    "title", "description", "caption", "spoken_script",
    "why_this_clip", "visual_direction", "editor_notes",
]

# Event categories
EVENTS = ["edit", "approve", "reject", "regenerate", "profile", "seed", "complete-review"]


def style_tag(style: str) -> str:    return f"style:{style}"
def intent_tag(intent: str) -> str:  return f"intent:{intent}"
def platform_tag(platform: str) -> str: return f"platform:{platform}"
def content_type_tag(ct: str) -> str: return f"content_type:{ct}"
def event_tag(ev: str) -> str:       return f"event:{ev}"
def creator_tag(name: str) -> str:
    slug = "".join(c.lower() if c.isalnum() else "-" for c in (name or "default")).strip("-")
    return f"creator:{slug or 'default'}"


def build_tags(
    *,
    creator_name: str | None = None,
    styles: list[str] | None = None,
    intents: list[str] | None = None,
    platforms: list[str] | None = None,
    content_type: str | None = None,
    event: str | None = None,
    extra: list[str] | None = None,
) -> list[str]:
    """Compose a structured tag list. Filters out None/empty."""
    tags: list[str] = []
    if creator_name: tags.append(creator_tag(creator_name))
    for s in (styles or []):    tags.append(style_tag(s))
    for i in (intents or []):   tags.append(intent_tag(i))
    for p in (platforms or []): tags.append(platform_tag(p))
    if content_type: tags.append(content_type_tag(content_type))
    if event:        tags.append(event_tag(event))
    tags.extend(extra or [])
    return tags

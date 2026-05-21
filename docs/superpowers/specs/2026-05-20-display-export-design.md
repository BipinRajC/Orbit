# Display & Export Feature Design
**Date:** 2026-05-20
**Status:** Approved

## Overview

Two improvements to how production briefs are presented and shared:

1. **Full script display** — show `opening`, `body`, `closer` as clearly labelled sections; fix any content clipping.
2. **Caption field** — Claude generates a platform-native caption per brief (included in display and export).
3. **Clipboard export** — one "Copy" button per platform brief that copies the full brief as formatted markdown.

## Backend: Caption Generation

**File:** `backend/app/domain/generation.py`

Add `caption` as a required string field in `BRIEF_SCHEMA`. Update the generation prompt to instruct Claude to write a platform-appropriate caption:

- **TikTok / Instagram Reels:** punchy opener, 2–3 relevant hashtags, hook in first line
- **LinkedIn:** professional tone, no hashtags, opens with a question or insight
- **Twitter / X:** ≤280 characters, direct and punchy

The field is added alongside the existing `hook`, `angle`, `script`, `cta`, `higgsfield_prompt`, and `editing_notes` fields.

## Frontend: Type Updates

**File:** `frontend/lib/types.ts`

- Add `caption?: string` to `ProductionBrief` interface.
- Update `normalizeBrief()` to pass `caption` through from the raw brief. Old v1 briefs without a caption field will result in `caption: undefined`, which the UI handles gracefully (field simply not rendered).

## Frontend: Script Display Fix

**File:** `frontend/components/production-brief-view.tsx`

- Remove `overflow-hidden` from the outer container (currently clips content).
- Render `script.opening`, `script.body`, and `script.closer` as three clearly labelled sub-sections, each with a bold heading.
- Add `caption` field rendered after `cta`, before `editing_notes`.
- No other layout changes; existing field order preserved for all other fields.

## Frontend: Markdown Export Utility

**New file:** `frontend/lib/export.ts`

Single exported function:

```ts
export function formatBriefAsMarkdown(
  brief: ProductionBrief,
  platform: string,
  momentTitle: string
): string
```

Output format:

```markdown
# [Platform] — [Moment Title]

## Hook
[hook]

## Angle
[angle]

## Script

**Opening**
[script.opening]

**Body**
[script.body]

**Closer**
[script.closer]

## CTA
[cta]

## Caption
[caption]

## Editing Notes
[editing_notes]

## Higgsfield Prompt
[higgsfield_prompt]
```

Optional fields (`caption`, `editing_notes`, `higgsfield_prompt`) are omitted from the output if undefined or empty.

## Frontend: Copy Button

**File:** `frontend/components/production-brief-view.tsx`

- Add a "Copy" button in the top-right of the brief card header.
- On click: call `formatBriefAsMarkdown()`, write result to `navigator.clipboard.writeText()`.
- Button label changes to "Copied!" for 2 seconds then resets to "Copy".
- No modal, no file download — inline clipboard feedback only.

## Data Flow

```
generation.py (BRIEF_SCHEMA + prompt)
  → caption field in DB (JSONB brief column)
    → API response → ProductionBrief type
      → normalizeBrief() → production-brief-view.tsx (display)
        → formatBriefAsMarkdown() → clipboard (export)
```

## Affected Files

| File | Change |
|------|--------|
| `backend/app/domain/generation.py` | Add `caption` to schema + prompt |
| `frontend/lib/types.ts` | Add `caption?: string`, update `normalizeBrief()` |
| `frontend/lib/export.ts` | New file — markdown formatter |
| `frontend/components/production-brief-view.tsx` | Display fix, caption field, copy button |

## Out of Scope

- "Copy All Platforms" button (can be added later)
- PDF or file download export
- Manual caption editing in the UI
- Retroactive caption generation for existing briefs (existing projects will simply show no caption)

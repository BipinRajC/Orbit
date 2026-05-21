import type { ProductionBrief, ShortFormDeliverable } from '@/lib/types'

const PLATFORM_LABELS: Record<string, string> = {
  instagram_reels: 'Instagram Reels',
  youtube_shorts:  'YouTube Shorts',
  tiktok:          'TikTok',
  linkedin:        'LinkedIn',
}

/**
 * Format a ShortFormDeliverable as copy-pasteable markdown.
 * The `projectTitle` param is optional context shown in the sub-header.
 */
export function formatDeliverableAsMarkdown(
  deliverable: ShortFormDeliverable,
  platform: string,
  projectTitle?: string,
): string {
  const platformLabel = PLATFORM_LABELS[platform] ?? platform
  const lines: string[] = []

  lines.push(`# ${deliverable.title}`)
  lines.push(`*${platformLabel}${projectTitle ? ` · ${projectTitle}` : ''}*`)
  lines.push('')

  lines.push('## Caption')
  lines.push(deliverable.caption)
  lines.push('')

  if (deliverable.description) {
    lines.push('## Description')
    lines.push(deliverable.description)
    lines.push('')
  }

  lines.push('## Spoken Script')
  lines.push(deliverable.spoken_script)
  lines.push('')

  if (deliverable.why_this_clip) {
    lines.push('## Why this clip')
    lines.push(deliverable.why_this_clip)
    lines.push('')
  }

  if (deliverable.visual_direction) {
    lines.push('## Visual direction (for AI generators)')
    lines.push(deliverable.visual_direction)
    lines.push('')
  }

  if (deliverable.editor_notes) {
    lines.push('## Editor notes (for AI editor)')
    lines.push(deliverable.editor_notes)
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

/**
 * @deprecated Use formatDeliverableAsMarkdown for new ShortFormDeliverable data.
 * Kept for any remaining legacy production_brief code paths.
 */
export function formatBriefAsMarkdown(
  brief: ProductionBrief,
  platform: string,
  momentTitle: string,
): string {
  const platformLabel = PLATFORM_LABELS[platform] ?? platform
  const lines: string[] = []

  lines.push(`# ${platformLabel} — ${momentTitle}`)
  lines.push('')

  lines.push('## Hook')
  lines.push(brief.hook)
  lines.push('')

  lines.push('## Angle')
  lines.push(brief.angle)
  lines.push('')

  lines.push('## Script')
  lines.push('')
  lines.push('**Opening**')
  lines.push(brief.script.opening)
  lines.push('')
  lines.push('**Body**')
  lines.push(brief.script.body)
  lines.push('')
  lines.push('**Closer**')
  lines.push(brief.script.closer)
  lines.push('')

  lines.push('## CTA')
  lines.push(brief.cta)
  lines.push('')

  if (brief.caption) {
    lines.push('## Caption')
    lines.push(brief.caption)
    lines.push('')
  }

  if (brief.editing_notes) {
    lines.push('## Editing Notes')
    lines.push(brief.editing_notes)
    lines.push('')
  }

  if (brief.higgsfield_prompt) {
    lines.push('## Higgsfield Prompt')
    lines.push(brief.higgsfield_prompt)
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

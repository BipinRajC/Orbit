import type { ProductionBrief } from '@/lib/types'

const PLATFORM_LABELS: Record<string, string> = {
  instagram_reels: 'Instagram Reels',
  youtube_shorts:  'YouTube Shorts',
  linkedin:        'LinkedIn',
}

/**
 * Format a production brief as a markdown string suitable for clipboard export.
 * Optional fields (caption, editing_notes, higgsfield_prompt) are omitted if empty.
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

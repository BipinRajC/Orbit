'use client'

import { useState } from 'react'
import type { Moment, Derivative } from '@/lib/types'
import { ProductionBriefTable } from './production-brief-table'
import { VideoClipPreview } from './video-clip-preview'
import { DraftEditor } from './draft-editor'

interface Props {
  moment: Moment
  index: number
  sourceUrl: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MomentGroup({ moment, index, sourceUrl }: Props) {
  const [derivatives, setDerivatives] = useState<Derivative[]>(moment.derivatives)

  function handleDerivativeUpdate(updated: Derivative) {
    setDerivatives(prev => prev.map(d => d.id === updated.id ? updated : d))
  }

  const scorePercent = Math.round(moment.strength_score * 100)

  // Separate production briefs from legacy derivatives
  const productionBriefs = derivatives.filter(d => d.content_type === 'production_brief')
  const legacyDerivatives = derivatives.filter(d => d.content_type !== 'production_brief')

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Moment header */}
      <div className="border-b border-zinc-100 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs font-bold text-white">
            {index + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">
                {formatTime(moment.start_timestamp)} — {formatTime(moment.end_timestamp)}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {scorePercent}% strength
              </span>
            </div>
            <blockquote className="mt-2 text-sm leading-relaxed text-zinc-700 italic">
              &ldquo;{moment.transcript_snippet}&rdquo;
            </blockquote>
            <p className="mt-1.5 text-xs text-zinc-400">
              {moment.selection_rationale}
            </p>
          </div>
        </div>
      </div>

      {/* Production Brief Table (new format) */}
      {productionBriefs.length > 0 && (
        <div className="p-5">
          <ProductionBriefTable
            derivatives={productionBriefs}
            onUpdate={handleDerivativeUpdate}
          />
        </div>
      )}

      {/* Legacy derivatives (old format — backwards compatible) */}
      {legacyDerivatives.length > 0 && (
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {legacyDerivatives.map(d => (
            <DraftEditor
              key={d.id}
              derivative={d}
              onUpdate={handleDerivativeUpdate}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {derivatives.length === 0 && (
        <div className="p-5">
          <p className="text-sm text-zinc-400">No derivatives generated yet.</p>
        </div>
      )}

      {/* Video clip preview — below the table */}
      <div className="border-t border-zinc-100 p-5">
        <VideoClipPreview
          sourceUrl={sourceUrl}
          startSeconds={moment.start_timestamp}
          endSeconds={moment.end_timestamp}
        />
      </div>
    </div>
  )
}

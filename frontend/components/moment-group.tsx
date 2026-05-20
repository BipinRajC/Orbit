'use client'

import { useState } from 'react'
import type { Moment, Derivative } from '@/lib/types'
import { DraftEditor } from './draft-editor'

interface Props {
  moment: Moment
  index: number
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MomentGroup({ moment, index }: Props) {
  const [derivatives, setDerivatives] = useState<Derivative[]>(moment.derivatives)

  function handleDerivativeUpdate(updated: Derivative) {
    setDerivatives(prev => prev.map(d => d.id === updated.id ? updated : d))
  }

  const scorePercent = Math.round(moment.strength_score * 100)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      {/* Moment header */}
      <div className="border-b border-zinc-100 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
            {index + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">
                {formatTime(moment.start_timestamp)} — {formatTime(moment.end_timestamp)}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                {scorePercent}% strength
              </span>
            </div>
            <blockquote className="mt-2 text-sm text-zinc-700 italic">
              &ldquo;{moment.transcript_snippet}&rdquo;
            </blockquote>
            <p className="mt-1.5 text-xs text-zinc-400">
              {moment.selection_rationale}
            </p>
          </div>
        </div>
      </div>

      {/* Derivatives */}
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {derivatives.length === 0 ? (
          <p className="col-span-2 text-sm text-zinc-400">No derivatives generated yet.</p>
        ) : (
          derivatives.map(d => (
            <DraftEditor
              key={d.id}
              derivative={d}
              onUpdate={handleDerivativeUpdate}
            />
          ))
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Moment, Derivative } from '@/lib/types'
import { DeliverableCard } from './deliverable-card'
import { VideoClipPreview } from './video-clip-preview'

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

  // Sort deliverables by platform display order
  const platformOrder = ['instagram_reels', 'youtube_shorts', 'tiktok', 'linkedin']
  const sortedDerivatives = [...derivatives].sort(
    (a, b) => platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform)
  )

  return (
    <div className="rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[4px_4px_0_#1a1a1a]">
      {/* Moment header */}
      <div className="border-b-2 border-[#1a1a1a] bg-[#FAF7F0] px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#FF8A65] text-xs font-black text-white shadow-[2px_2px_0_#1a1a1a]">
            {index + 1}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-[#1a1a1a]/60">
                {formatTime(moment.start_timestamp)} — {formatTime(moment.end_timestamp)}
              </span>
              <span className="rounded-full border border-[#1a1a1a] bg-[#A5D6A7] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#1a1a1a]">
                {scorePercent}% strength
              </span>
            </div>
            <blockquote className="mt-2 text-sm leading-relaxed text-[#1a1a1a]/80 italic">
              &ldquo;{moment.transcript_snippet}&rdquo;
            </blockquote>
            {moment.selection_rationale && (
              <p className="mt-1.5 text-xs text-[#1a1a1a]/50">
                {moment.selection_rationale}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Video clip preview */}
      <div className="border-b-2 border-[#1a1a1a] px-5 py-4">
        <VideoClipPreview
          sourceUrl={sourceUrl}
          startSeconds={moment.start_timestamp}
          endSeconds={moment.end_timestamp}
          clipUrl={moment.clip_url}
          projectId={moment.project_id}
          momentId={moment.id}
        />
      </div>

      {/* Deliverable cards — one per platform */}
      {sortedDerivatives.length > 0 ? (
        <div className={`grid gap-5 p-5${sortedDerivatives.length > 1 ? ' sm:grid-cols-2' : ''}`}>
          {sortedDerivatives.map(d => (
            <DeliverableCard
              key={d.id}
              derivative={d}
              onUpdate={handleDerivativeUpdate}
              momentTitle={moment.transcript_snippet?.slice(0, 60)}
            />
          ))}
        </div>
      ) : (
        <div className="p-5">
          <p className="text-sm text-[#1a1a1a]/40">No deliverables generated yet.</p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Moment, Derivative, Platform } from '@/lib/types'
import { VideoPlayer } from './video-player'
import { ProductionBriefView } from './production-brief-view'
import { PlatformCompareTable } from './platform-compare-table'

interface Props {
  moment: Moment
  index: number
  sourceUrl: string
  targetPlatforms?: Platform[]
}

const PLATFORM_META: Record<Platform, { label: string; icon: string }> = {
  instagram_reels: { label: 'Instagram Reels', icon: '◎' },
  youtube_shorts:  { label: 'YouTube Shorts',  icon: '▶' },
  linkedin:        { label: 'LinkedIn',         icon: '◆' },
}

const PLATFORM_ORDER: Platform[] = ['instagram_reels', 'youtube_shorts', 'linkedin']

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTimestamps(moment: Moment): string {
  const segs = moment.segments
  if (segs && segs.length > 1) {
    return segs
      .map(s => `${formatTime(s.start)}–${formatTime(s.end)}`)
      .join(' + ')
  }
  return `${formatTime(moment.start_timestamp)}–${formatTime(moment.end_timestamp)}`
}

export function MomentCard({ moment, index, sourceUrl, targetPlatforms }: Props) {
  const [derivatives, setDerivatives] = useState<Derivative[]>(moment.derivatives)
  const [activePlatform, setActivePlatform] = useState<Platform>(
    (targetPlatforms?.[0] ?? 'instagram_reels') as Platform
  )
  const [showCompare, setShowCompare] = useState(false)

  function handleDerivativeUpdate(updated: Derivative) {
    setDerivatives(prev => prev.map(d => d.id === updated.id ? updated : d))
  }

  const platforms = (targetPlatforms ?? PLATFORM_ORDER).filter(p =>
    derivatives.some(d => d.platform === p && d.content_type === 'production_brief')
  )

  const activeBrief = derivatives.find(
    d => d.platform === activePlatform && d.content_type === 'production_brief'
  )

  const scorePercent = Math.round(moment.strength_score * 100)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-zinc-100 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs font-bold text-white">
            {index + 1}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-zinc-400">{formatTimestamps(moment)}</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {scorePercent}% strength
              </span>
              {moment.segments && moment.segments.length > 1 && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                  {moment.segments.length}-segment
                </span>
              )}
            </div>
            <blockquote className="mt-2 text-sm leading-relaxed text-zinc-700 italic">
              &ldquo;{moment.transcript_snippet}&rdquo;
            </blockquote>
            {moment.narrative_summary && (
              <p className="mt-1.5 text-xs text-zinc-500">{moment.narrative_summary}</p>
            )}
            {!moment.narrative_summary && moment.selection_rationale && (
              <p className="mt-1.5 text-xs text-zinc-400">{moment.selection_rationale}</p>
            )}
          </div>
        </div>
      </div>

      {/* Video player */}
      <div className="border-b border-zinc-100 p-5">
        <VideoPlayer
          clipUrl={moment.clip_url}
          fallbackYouTubeUrl={sourceUrl}
          startSeconds={moment.start_timestamp}
          endSeconds={moment.end_timestamp}
        />
      </div>

      {/* Platform tab bar */}
      {platforms.length > 0 && (
        <div className="border-b border-zinc-100 px-5 pt-4">
          <div className="flex items-center gap-1 text-xs">
            {platforms.map(p => {
              const meta = PLATFORM_META[p]
              const isActive = p === activePlatform && !showCompare
              return (
                <button
                  key={p}
                  onClick={() => { setActivePlatform(p); setShowCompare(false) }}
                  className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-zinc-900 border border-b-0 border-zinc-200'
                      : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <span>{meta.icon}</span>
                  {meta.label}
                </button>
              )
            })}
            {platforms.length > 1 && (
              <button
                onClick={() => setShowCompare(c => !c)}
                className={`ml-auto flex items-center gap-1 rounded px-3 py-2 text-xs font-medium transition-colors ${
                  showCompare
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                Compare All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Brief content */}
      <div className="p-5">
        {showCompare ? (
          <PlatformCompareTable
            derivatives={derivatives}
            onUpdate={handleDerivativeUpdate}
          />
        ) : activeBrief ? (
          <ProductionBriefView
            derivative={activeBrief}
            momentTitle={moment.narrative_summary ?? moment.transcript_snippet.slice(0, 60)}
            onUpdate={handleDerivativeUpdate}
          />
        ) : (
          <p className="text-sm text-zinc-400">No brief generated yet.</p>
        )}
      </div>
    </div>
  )
}

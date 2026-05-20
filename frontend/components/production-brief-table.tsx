'use client'

import { useState } from 'react'
import type { Derivative, ProductionBrief } from '@/lib/types'
import { normalizeBrief } from '@/lib/types'
import { api } from '@/lib/api'

interface Props {
  derivatives: Derivative[]
  onUpdate: (updated: Derivative) => void
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  instagram_reels: { label: 'Instagram Reels', color: 'from-pink-500 to-purple-600', icon: '◎' },
  youtube_shorts: { label: 'YouTube Shorts', color: 'from-red-500 to-red-700', icon: '▶' },
  linkedin: { label: 'LinkedIn', color: 'from-blue-600 to-blue-800', icon: '◆' },
}

const SECTION_LABELS = [
  { key: 'hook',              label: 'Hook',       sublabel: '0-3s' },
  { key: 'script.body',       label: 'Body',       sublabel: '3-45s' },
  { key: 'cta',               label: 'CTA',        sublabel: 'close' },
  { key: 'higgsfield_prompt', label: 'Higgsfield', sublabel: 'visual AI' },
] as const

function parseBrief(content: string): ProductionBrief | null {
  try {
    return normalizeBrief(JSON.parse(content) as Record<string, unknown>)
  } catch {
    return null
  }
}

function getField(brief: ProductionBrief, key: string): string {
  if (key === 'script.body') return brief.script?.body ?? ''
  const val = (brief as unknown as Record<string, unknown>)[key]
  return typeof val === 'string' ? val : ''
}

export function ProductionBriefTable({ derivatives, onUpdate }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [regenId, setRegenId] = useState<string | null>(null)
  const [guidance, setGuidance] = useState('')

  // Filter to production_brief type and sort by platform order
  const platformOrder = ['instagram_reels', 'youtube_shorts', 'linkedin']
  const briefs = platformOrder
    .map(p => derivatives.find(d => d.platform === p && d.content_type === 'production_brief'))
    .filter(Boolean) as Derivative[]

  if (briefs.length === 0) return null

  async function handleApprove(d: Derivative) {
    setLoadingId(d.id)
    try { onUpdate(await api.derivatives.approve(d.id)) }
    finally { setLoadingId(null) }
  }

  async function handleReject(d: Derivative) {
    setLoadingId(d.id)
    try { onUpdate(await api.derivatives.reject(d.id)) }
    finally { setLoadingId(null) }
  }

  async function handleRegen(d: Derivative) {
    setLoadingId(d.id)
    try {
      const updated = await api.derivatives.regenerate(d.id, guidance || undefined)
      onUpdate(updated)
      setRegenId(null)
      setGuidance('')
    } finally { setLoadingId(null) }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      {/* Table header */}
      <div className="grid grid-cols-[120px_repeat(3,1fr)] border-b border-zinc-100 bg-zinc-50/80">
        <div className="p-3" />
        {briefs.map(d => {
          const meta = PLATFORM_META[d.platform] || { label: d.platform, color: 'from-zinc-500 to-zinc-700', icon: '•' }
          return (
            <div key={d.id} className="border-l border-zinc-100 p-3 text-center">
              <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${meta.color} px-3 py-1 text-xs font-medium text-white`}>
                <span>{meta.icon}</span>
                {meta.label}
              </div>
              {/* Status badge */}
              <div className="mt-1.5">
                {d.status === 'approved' && (
                  <span className="text-[10px] font-medium text-emerald-600">✓ Approved</span>
                )}
                {d.status === 'rejected' && (
                  <span className="text-[10px] text-zinc-400">✗ Rejected</span>
                )}
                {d.status === 'draft' && (
                  <span className="text-[10px] text-zinc-400">Draft</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Table rows — one per section */}
      {SECTION_LABELS.map(({ key, label, sublabel }) => (
        <div key={key} className="grid grid-cols-[120px_repeat(3,1fr)] border-b border-zinc-50 last:border-b-0">
          {/* Row label */}
          <div className="flex flex-col justify-center border-r border-zinc-100 bg-zinc-50/50 p-3">
            <span className="text-xs font-semibold text-zinc-700">{label}</span>
            <span className="text-[10px] text-zinc-400">{sublabel}</span>
          </div>
          {/* Platform cells */}
          {briefs.map(d => {
            const brief = parseBrief(d.content)
            const value = brief ? getField(brief, key) : ''
            const isVisual = key === 'higgsfield_prompt'
            return (
              <div
                key={`${d.id}-${key}`}
                className={`border-l border-zinc-50 p-3 ${isVisual ? 'bg-violet-50/30' : ''}`}
              >
                <p className={`text-xs leading-relaxed ${
                  isVisual ? 'font-mono text-violet-700' : 'text-zinc-700'
                } ${key === 'hook' ? 'font-semibold text-zinc-900' : ''}`}>
                  {value || <span className="italic text-zinc-300">—</span>}
                </p>
              </div>
            )
          })}
        </div>
      ))}

      {/* Actions row */}
      <div className="grid grid-cols-[120px_repeat(3,1fr)] border-t border-zinc-200 bg-zinc-50/40">
        <div className="flex items-center border-r border-zinc-100 p-3">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Actions</span>
        </div>
        {briefs.map(d => (
          <div key={`actions-${d.id}`} className="flex flex-wrap items-center gap-1.5 border-l border-zinc-100 p-3">
            {d.status !== 'rejected' && (
              <>
                {d.status !== 'approved' && (
                  <button
                    onClick={() => handleApprove(d)}
                    disabled={loadingId === d.id}
                    className="btn-xs btn-primary"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => setRegenId(regenId === d.id ? null : d.id)}
                  disabled={loadingId === d.id}
                  className="btn-xs btn-ghost"
                >
                  Regen
                </button>
                <button
                  onClick={() => handleReject(d)}
                  disabled={loadingId === d.id}
                  className="btn-xs btn-ghost text-zinc-400"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Regen input (shown below the table when active) */}
      {regenId && (
        <div className="border-t border-zinc-200 bg-white p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={guidance}
              onChange={e => setGuidance(e.target.value)}
              placeholder="Optional guidance (e.g. 'make the hook more confrontational', 'shorter body')..."
              className="flex-1 rounded border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-400"
            />
            <button
              onClick={() => {
                const d = briefs.find(b => b.id === regenId)
                if (d) handleRegen(d)
              }}
              disabled={!!loadingId}
              className="btn-xs btn-primary"
            >
              {loadingId ? '...' : 'Regenerate'}
            </button>
            <button
              onClick={() => { setRegenId(null); setGuidance('') }}
              className="btn-xs btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Derivative, ProductionBrief } from '@/lib/types'
import { api } from '@/lib/api'

interface Props {
  derivative: Derivative
  onUpdate: (updated: Derivative) => void
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  instagram_reels: { label: 'Instagram Reels', color: 'from-pink-500 to-purple-600', icon: '◎' },
  youtube_shorts:  { label: 'YouTube Shorts',  color: 'from-red-500 to-red-700',     icon: '▶' },
  linkedin:        { label: 'LinkedIn',         color: 'from-blue-600 to-blue-800',   icon: '◆' },
}

function parseBrief(content: string): ProductionBrief | null {
  try { return JSON.parse(content) } catch { return null }
}

export function ProductionBriefView({ derivative, onUpdate }: Props) {
  const [loading, setLoading] = useState(false)
  const [showRegen, setShowRegen] = useState(false)
  const [guidance, setGuidance] = useState('')

  const brief = parseBrief(derivative.content)
  const meta = PLATFORM_META[derivative.platform] || { label: derivative.platform, color: 'from-zinc-500 to-zinc-700', icon: '•' }

  async function handleApprove() {
    setLoading(true)
    try { onUpdate(await api.derivatives.approve(derivative.id)) }
    finally { setLoading(false) }
  }

  async function handleReject() {
    setLoading(true)
    try { onUpdate(await api.derivatives.reject(derivative.id)) }
    finally { setLoading(false) }
  }

  async function handleRegen() {
    setLoading(true)
    try {
      onUpdate(await api.derivatives.regenerate(derivative.id, guidance || undefined))
      setShowRegen(false)
      setGuidance('')
    } finally { setLoading(false) }
  }

  if (!brief) return null

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {/* Platform header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${meta.color} px-3 py-1 text-xs font-medium text-white`}>
          <span>{meta.icon}</span>
          {meta.label}
        </div>
        <div className="flex items-center gap-1.5">
          {derivative.status === 'approved' && (
            <span className="text-[10px] font-medium text-emerald-600">✓ Approved</span>
          )}
          {derivative.status === 'rejected' && (
            <span className="text-[10px] text-zinc-400">✗ Rejected</span>
          )}
          {derivative.status === 'draft' && (
            <span className="text-[10px] text-zinc-400">Draft</span>
          )}
        </div>
      </div>

      <div className="space-y-0 divide-y divide-zinc-50">
        {/* Hook */}
        <div className="px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Hook</p>
          <p className="text-sm font-semibold text-zinc-900">&ldquo;{brief.hook}&rdquo;</p>
        </div>

        {/* Angle */}
        {brief.angle && (
          <div className="px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Angle</p>
            <p className="text-xs leading-relaxed text-zinc-600">{brief.angle}</p>
          </div>
        )}

        {/* Script */}
        <div className="px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Script</p>
          <div className="space-y-2">
            {brief.script?.opening && (
              <div>
                <span className="text-[10px] font-medium text-zinc-400">Opening · </span>
                <span className="text-xs leading-relaxed text-zinc-700">{brief.script.opening}</span>
              </div>
            )}
            {brief.script?.body && (
              <div>
                <span className="text-[10px] font-medium text-zinc-400">Body · </span>
                <span className="text-xs leading-relaxed text-zinc-700">{brief.script.body}</span>
              </div>
            )}
            {brief.script?.closer && (
              <div>
                <span className="text-[10px] font-medium text-zinc-400">Closer · </span>
                <span className="text-xs leading-relaxed text-zinc-700">{brief.script.closer}</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">CTA</p>
          <p className="text-xs text-zinc-700">{brief.cta}</p>
        </div>

        {/* Higgsfield */}
        {brief.higgsfield_prompt && (
          <div className="bg-violet-50/30 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-400">Higgsfield</p>
            <p className="font-mono text-xs text-violet-700 leading-relaxed">{brief.higgsfield_prompt}</p>
          </div>
        )}

        {/* Editing notes */}
        {brief.editing_notes && (
          <div className="bg-amber-50/30 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500">Editing Notes</p>
            <p className="text-xs leading-relaxed text-amber-800">{brief.editing_notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {derivative.status !== 'rejected' && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {derivative.status !== 'approved' && (
              <button onClick={handleApprove} disabled={loading} className="btn-xs btn-primary">
                Approve
              </button>
            )}
            <button onClick={() => setShowRegen(r => !r)} disabled={loading} className="btn-xs btn-ghost">
              Regen
            </button>
            <button onClick={handleReject} disabled={loading} className="btn-xs btn-ghost text-zinc-400">
              Reject
            </button>
          </div>

          {showRegen && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={guidance}
                onChange={e => setGuidance(e.target.value)}
                placeholder="Optional guidance (e.g. 'punchier hook', 'more professional')..."
                className="flex-1 rounded border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-400"
              />
              <button onClick={handleRegen} disabled={loading} className="btn-xs btn-primary">
                {loading ? '...' : 'Go'}
              </button>
              <button onClick={() => { setShowRegen(false); setGuidance('') }} className="btn-xs btn-ghost">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Derivative } from '@/lib/types'
import { api } from '@/lib/api'

interface Props {
  derivative: Derivative
  onUpdate: (updated: Derivative) => void
}

const TYPE_LABELS: Record<string, string> = {
  hook: 'Hook',
  tweet: 'Tweet',
  framing: 'Framing',
  caption: 'Caption',
}

const PLATFORM_LABELS: Record<string, string> = {
  short_form_video: 'Short-form video',
  twitter: 'Twitter / X',
}

export function DraftEditor({ derivative, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(derivative.content)
  const [loading, setLoading] = useState<string | null>(null)
  const [regenGuidance, setRegenGuidance] = useState('')
  const [showRegenInput, setShowRegenInput] = useState(false)

  // Framing content is stored as JSON — render it nicely
  const isFraming = derivative.content_type === 'framing'
  let framingData: Record<string, string> | null = null
  if (isFraming) {
    try { framingData = JSON.parse(derivative.content) } catch { /* raw text fallback */ }
  }

  async function handleSave() {
    if (draft === derivative.content) { setEditing(false); return }
    setLoading('save')
    try {
      const updated = await api.derivatives.edit(derivative.id, draft)
      onUpdate(updated)
      setEditing(false)
    } finally {
      setLoading(null)
    }
  }

  async function handleApprove() {
    setLoading('approve')
    try { onUpdate(await api.derivatives.approve(derivative.id)) }
    finally { setLoading(null) }
  }

  async function handleReject() {
    setLoading('reject')
    try { onUpdate(await api.derivatives.reject(derivative.id)) }
    finally { setLoading(null) }
  }

  async function handleRegen() {
    setLoading('regen')
    try {
      const updated = await api.derivatives.regenerate(derivative.id, regenGuidance || undefined)
      onUpdate(updated)
      setRegenGuidance('')
      setShowRegenInput(false)
    } finally {
      setLoading(null)
    }
  }

  const statusClass = {
    draft: 'border-zinc-200',
    approved: 'border-emerald-300 bg-emerald-50/40',
    rejected: 'border-zinc-200 opacity-50',
  }[derivative.status]

  return (
    <div className={`rounded-lg border p-4 ${statusClass}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">
            {TYPE_LABELS[derivative.content_type] ?? derivative.content_type}
          </span>
          <span className="text-xs text-zinc-300">·</span>
          <span className="text-xs text-zinc-400">
            {PLATFORM_LABELS[derivative.platform] ?? derivative.platform}
          </span>
        </div>
        {derivative.status === 'approved' && (
          <span className="text-xs font-medium text-emerald-600">Approved</span>
        )}
        {derivative.status === 'rejected' && (
          <span className="text-xs text-zinc-400">Rejected</span>
        )}
      </div>

      {/* Content display / editor */}
      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={isFraming ? 6 : 3}
          className="w-full resize-none rounded border border-zinc-300 bg-white p-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
        />
      ) : isFraming && framingData ? (
        <div className="space-y-1 text-sm text-zinc-700">
          <p><span className="text-xs font-medium text-zinc-400">Caption: </span>{framingData.caption}</p>
          <p><span className="text-xs font-medium text-zinc-400">Hook: </span>{framingData.hook_concept}</p>
          <p><span className="text-xs font-medium text-zinc-400">Direction: </span>{framingData.visual_direction}</p>
        </div>
      ) : (
        <p className="text-sm text-zinc-800">{derivative.content}</p>
      )}

      {/* Actions */}
      {derivative.status !== 'rejected' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={loading === 'save'}
                className="btn-xs btn-primary"
              >
                {loading === 'save' ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setDraft(derivative.content) }} className="btn-xs btn-ghost">
                Cancel
              </button>
            </>
          ) : (
            <>
              {derivative.status !== 'approved' && (
                <button onClick={handleApprove} disabled={!!loading} className="btn-xs btn-primary">
                  {loading === 'approve' ? '...' : 'Approve'}
                </button>
              )}
              <button onClick={() => setEditing(true)} disabled={!!loading} className="btn-xs btn-ghost">
                Edit
              </button>
              <button
                onClick={() => setShowRegenInput(v => !v)}
                disabled={!!loading}
                className="btn-xs btn-ghost"
              >
                Regenerate
              </button>
              <button onClick={handleReject} disabled={!!loading} className="btn-xs btn-ghost text-zinc-400">
                {loading === 'reject' ? '...' : 'Reject'}
              </button>
            </>
          )}
        </div>
      )}

      {showRegenInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={regenGuidance}
            onChange={e => setRegenGuidance(e.target.value)}
            placeholder="Optional guidance (e.g. make it shorter)..."
            className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400"
          />
          <button
            onClick={handleRegen}
            disabled={loading === 'regen'}
            className="btn-xs btn-primary"
          >
            {loading === 'regen' ? '...' : 'Go'}
          </button>
        </div>
      )}
    </div>
  )
}

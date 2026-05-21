'use client'

import { useState } from 'react'
import type { Derivative } from '@/lib/types'
import { api } from '@/lib/api'
import { Brain, X } from 'lucide-react'

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

// ─── Word-level diff (LCS) ────────────────────────────────────────────────
type DiffOp = { type: 'same' | 'removed' | 'added'; word: string }

function wordDiff(before: string, after: string): DiffOp[] {
  const b = before.split(/(\s+)/).filter(Boolean)
  const a = after.split(/(\s+)/).filter(Boolean)
  const m = b.length, n = a.length
  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = b[i-1] === a[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
  // Traceback
  const ops: DiffOp[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && b[i-1] === a[j-1]) {
      ops.unshift({ type: 'same', word: b[i-1] }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({ type: 'added', word: a[j-1] }); j--
    } else {
      ops.unshift({ type: 'removed', word: b[i-1] }); i--
    }
  }
  return ops
}

// ─── Diff display component ───────────────────────────────────────────────
function DiffView({ before, after, onDismiss }: { before: string; after: string; onDismiss: () => void }) {
  const ops = wordDiff(before, after)
  const removedCount = ops.filter(o => o.type === 'removed').length
  const addedCount   = ops.filter(o => o.type === 'added').length

  return (
    <div className="mt-3 overflow-hidden rounded-lg border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0_#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-[#FAF7F0] px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-[#9575CD]">
            <Brain className="h-3 w-3 text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#1a1a1a]">
            Saved to Hindsight Memory
          </span>
        </div>
        <div className="flex items-center gap-2">
          {removedCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-600">
              -{removedCount} words
            </span>
          )}
          {addedCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-600">
              +{addedCount} words
            </span>
          )}
          <button onClick={onDismiss} className="text-[#1a1a1a]/30 hover:text-[#1a1a1a]/70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Diff body */}
      <div className="px-3 py-2.5 text-sm leading-relaxed text-[#1a1a1a]">
        {ops.map((op, i) => {
          if (op.type === 'same') return <span key={i}>{op.word}</span>
          if (op.type === 'removed') return (
            <span key={i} className="rounded bg-red-100 px-0.5 text-red-700 line-through decoration-red-400">
              {op.word}
            </span>
          )
          return (
            <span key={i} className="rounded bg-green-100 px-0.5 text-green-800 font-medium">
              {op.word}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────
export function DraftEditor({ derivative, onUpdate }: Props) {
  const [editing, setEditing]           = useState(false)
  const [draft, setDraft]               = useState(derivative.content)
  const [loading, setLoading]           = useState<string | null>(null)
  const [regenGuidance, setRegenGuidance]   = useState('')
  const [showRegenInput, setShowRegenInput] = useState(false)
  const [savedDiff, setSavedDiff]       = useState<{ before: string; after: string } | null>(null)
  const [originalContent, setOriginalContent] = useState(derivative.content)

  // Framing content is stored as JSON — render it nicely
  const isFraming = (derivative.content_type as string) === 'framing'
  let framingData: Record<string, string> | null = null
  if (isFraming) {
    try { framingData = JSON.parse(derivative.content) } catch { /* raw text fallback */ }
  }

  function startEditing() {
    setOriginalContent(derivative.content)
    setDraft(derivative.content)
    setSavedDiff(null)
    setEditing(true)
  }

  async function handleSave() {
    if (draft === derivative.content) { setEditing(false); return }
    setLoading('save')
    try {
      const updated = await api.derivatives.edit(derivative.id, draft)
      // Show word diff before the content updates
      setSavedDiff({ before: originalContent, after: draft })
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
              <button onClick={startEditing} disabled={!!loading} className="btn-xs btn-ghost">
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

      {/* Word-level diff — shown after save, dismissed by X */}
      {savedDiff && !editing && (
        <DiffView
          before={savedDiff.before}
          after={savedDiff.after}
          onDismiss={() => setSavedDiff(null)}
        />
      )}
    </div>
  )
}

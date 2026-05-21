'use client'

import { useState } from 'react'
import type { Derivative, ProductionBrief } from '@/lib/types'
import { normalizeBrief } from '@/lib/types'
import { api } from '@/lib/api'
import { Brain, X } from 'lucide-react'

// ─── Word-level diff (LCS) ────────────────────────────────────────────────
type DiffOp = { type: 'same' | 'removed' | 'added'; word: string }

function wordDiff(before: string, after: string): DiffOp[] {
  const b = before.split(/(\s+)/).filter(Boolean)
  const a = after.split(/(\s+)/).filter(Boolean)
  const m = b.length, n = a.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = b[i-1] === a[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
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

type FieldDiff = { label: string; before: string; after: string }

function DiffPanel({ fieldDiffs, onDismiss }: { fieldDiffs: FieldDiff[]; onDismiss: () => void }) {
  const allOps = fieldDiffs.flatMap(f => wordDiff(f.before, f.after))
  const removedCount = allOps.filter(o => o.type === 'removed').length
  const addedCount   = allOps.filter(o => o.type === 'added').length

  return (
    <div className="border-t-2 border-[#1a1a1a] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1a1a1a]/10 bg-[#F3E5F5] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-[#9575CD]">
            <Brain className="h-3 w-3 text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#6A1B9A]">
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
          <button onClick={onDismiss} className="text-[#9575CD]/40 hover:text-[#9575CD]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Per-field diffs */}
      <div className="divide-y divide-[#1a1a1a]/5 px-4 py-3 space-y-3">
        {fieldDiffs.filter(f => f.before !== f.after).map(f => {
          const ops = wordDiff(f.before, f.after)
          return (
            <div key={f.label}>
              <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-[#1a1a1a]/40">{f.label}</p>
              <p className="text-xs leading-relaxed text-[#1a1a1a]">
                {ops.map((op, idx) => {
                  if (op.type === 'same')    return <span key={idx}>{op.word}</span>
                  if (op.type === 'removed') return <span key={idx} className="rounded bg-red-100 px-0.5 text-red-700 line-through decoration-red-400">{op.word}</span>
                  return <span key={idx} className="rounded bg-green-100 px-0.5 text-green-800 font-medium">{op.word}</span>
                })}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  derivatives: Derivative[]
  onUpdate: (updated: Derivative) => void
}

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  instagram_reels: { label: 'Instagram Reels', color: 'from-pink-500 to-purple-600' },
  youtube_shorts:  { label: 'YouTube Shorts',  color: 'from-red-500 to-red-700' },
  linkedin:        { label: 'LinkedIn',         color: 'from-blue-600 to-blue-800' },
}

function PlatformLogo({ platform }: { platform: string }) {
  if (platform === 'instagram_reels') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
  if (platform === 'youtube_shorts') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
  // linkedin
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
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
  const [loadingId, setLoadingId]     = useState<string | null>(null)
  const [regenId, setRegenId]         = useState<string | null>(null)
  const [guidance, setGuidance]       = useState('')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editFields, setEditFields]   = useState<Record<string, string>>({})
  const [originalFields, setOriginalFields] = useState<Record<string, string>>({})
  const [savedDiff, setSavedDiff]     = useState<FieldDiff[] | null>(null)

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

  function startEdit(d: Derivative) {
    const brief = parseBrief(d.content)
    const fields = {
      hook:              brief ? getField(brief, 'hook') : '',
      'script.body':     brief ? getField(brief, 'script.body') : '',
      cta:               brief ? getField(brief, 'cta') : '',
      higgsfield_prompt: brief ? getField(brief, 'higgsfield_prompt') : '',
    }
    setOriginalFields(fields)
    setEditFields(fields)
    setEditingId(d.id)
    setRegenId(null)
    setSavedDiff(null)
  }

  async function handleSave(d: Derivative) {
    setLoadingId(d.id)
    try {
      const existing = parseBrief(d.content) ?? {} as ProductionBrief
      const updated_brief = {
        ...existing,
        hook:              editFields['hook'] ?? getField(existing as ProductionBrief, 'hook'),
        script:            { ...(existing.script ?? {}), body: editFields['script.body'] ?? '' },
        cta:               editFields['cta'] ?? getField(existing as ProductionBrief, 'cta'),
        higgsfield_prompt: editFields['higgsfield_prompt'] ?? getField(existing as ProductionBrief, 'higgsfield_prompt'),
      }
      const updated = await api.derivatives.edit(d.id, JSON.stringify(updated_brief))
      onUpdate(updated)
      setEditingId(null)
      // Build per-field diffs for display
      const diffs: FieldDiff[] = [
        { label: 'Hook',       before: originalFields['hook'] ?? '',              after: editFields['hook'] ?? '' },
        { label: 'Body',       before: originalFields['script.body'] ?? '',       after: editFields['script.body'] ?? '' },
        { label: 'CTA',        before: originalFields['cta'] ?? '',               after: editFields['cta'] ?? '' },
        { label: 'Higgsfield', before: originalFields['higgsfield_prompt'] ?? '', after: editFields['higgsfield_prompt'] ?? '' },
      ].filter(f => f.before !== f.after)
      setSavedDiff(diffs.length > 0 ? diffs : null)
    } finally { setLoadingId(null) }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      {/* Table header */}
      {/* Dynamic column count based on how many platforms were selected */}
      <div
        className="border-b border-zinc-100 bg-zinc-50/80"
        style={{ display: 'grid', gridTemplateColumns: `120px repeat(${briefs.length}, 1fr)` }}
      >
        <div className="p-3" />
        {briefs.map(d => {
          const meta = PLATFORM_META[d.platform] || { label: d.platform, color: 'from-zinc-500 to-zinc-700' }
          return (
            <div key={d.id} className="border-l border-zinc-100 p-3 text-center">
              <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${meta.color} px-3 py-1 text-xs font-medium text-white`}>
                <PlatformLogo platform={d.platform} />
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
        <div
          key={key}
          className="border-b border-zinc-50 last:border-b-0"
          style={{ display: 'grid', gridTemplateColumns: `120px repeat(${briefs.length}, 1fr)` }}
        >
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
            const isEditing = editingId === d.id
            return (
              <div
                key={`${d.id}-${key}`}
                className={`border-l border-zinc-50 p-3 ${isVisual ? 'bg-violet-50/30' : ''}`}
              >
                {isEditing ? (
                  <textarea
                    value={editFields[key] ?? value}
                    onChange={e => setEditFields(f => ({ ...f, [key]: e.target.value }))}
                    rows={key === 'script.body' ? 5 : 2}
                    className={`w-full resize-none rounded border border-zinc-300 bg-white p-1.5 text-xs leading-relaxed outline-none focus:border-zinc-500 ${
                      isVisual ? 'font-mono text-violet-700' : 'text-zinc-800'
                    } ${key === 'hook' ? 'font-semibold' : ''}`}
                  />
                ) : (
                  <p className={`text-xs leading-relaxed ${
                    isVisual ? 'font-mono text-violet-700' : 'text-zinc-700'
                  } ${key === 'hook' ? 'font-semibold text-zinc-900' : ''}`}>
                    {value || <span className="italic text-zinc-300">—</span>}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Actions row */}
      <div
        className="border-t border-zinc-200 bg-zinc-50/40"
        style={{ display: 'grid', gridTemplateColumns: `120px repeat(${briefs.length}, 1fr)` }}
      >
        <div className="flex items-center border-r border-zinc-100 p-3">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Actions</span>
        </div>
        {briefs.map(d => (
          <div key={`actions-${d.id}`} className="flex flex-wrap items-center gap-1.5 border-l border-zinc-100 p-3">
            {editingId === d.id ? (
              <>
                <button
                  onClick={() => handleSave(d)}
                  disabled={loadingId === d.id}
                  className="btn-xs btn-primary"
                >
                  {loadingId === d.id ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="btn-xs btn-ghost"
                >
                  Cancel
                </button>
              </>
            ) : d.status !== 'rejected' ? (
              <>
                {d.status !== 'approved' && (
                  <button
                    onClick={() => handleApprove(d)}
                    disabled={!!loadingId}
                    className="btn-xs btn-primary"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => startEdit(d)}
                  disabled={!!loadingId}
                  className="btn-xs btn-ghost"
                >
                  Edit
                </button>
                <button
                  onClick={() => setRegenId(regenId === d.id ? null : d.id)}
                  disabled={!!loadingId}
                  className="btn-xs btn-ghost"
                >
                  Regen
                </button>
                <button
                  onClick={() => handleReject(d)}
                  disabled={!!loadingId}
                  className="btn-xs btn-ghost text-zinc-400"
                >
                  Reject
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>

      {/* Word-level diff panel — shown after save */}
      {savedDiff && (
        <DiffPanel fieldDiffs={savedDiff} onDismiss={() => setSavedDiff(null)} />
      )}

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

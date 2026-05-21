'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, Copy, Check, X, Brain } from 'lucide-react'
import type { Derivative, ShortFormDeliverable } from '@/lib/types'
import { normalizeDeliverable } from '@/lib/types'
import { api } from '@/lib/api'
import { formatDeliverableAsMarkdown } from '@/lib/export'

// ─── Word-level LCS diff ──────────────────────────────────────────────────

type DiffOp = { type: 'same' | 'removed' | 'added'; word: string }

function wordDiff(before: string, after: string): DiffOp[] {
  const b = before.split(/(\s+)/).filter(Boolean)
  const a = after.split(/(\s+)/).filter(Boolean)
  const m = b.length, n = a.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = b[i - 1] === a[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const ops: DiffOp[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && b[i - 1] === a[j - 1]) {
      ops.unshift({ type: 'same', word: b[i - 1] }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', word: a[j - 1] }); j--
    } else {
      ops.unshift({ type: 'removed', word: b[i - 1] }); i--
    }
  }
  return ops
}

// ─── Platform metadata ────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; accent: string }> = {
  instagram_reels: { label: 'Instagram Reels', accent: '#E1306C' },
  youtube_shorts:  { label: 'YouTube Shorts',  accent: '#FF0000' },
  tiktok:          { label: 'TikTok',          accent: '#010101' },
  linkedin:        { label: 'LinkedIn',         accent: '#0A66C2' },
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'instagram_reels') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
  if (platform === 'youtube_shorts') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
  if (platform === 'tiktok') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/>
    </svg>
  )
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────

function CollapsibleSection({
  label,
  value,
  isEditing,
  editValue,
  onEditChange,
  onRegen,
  regenLoading,
  diffOps,
}: {
  label: string
  value: string
  isEditing: boolean
  editValue: string
  onEditChange: (v: string) => void
  onRegen: () => void
  regenLoading: boolean
  diffOps: DiffOp[] | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-[#1a1a1a]/10">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[#FAF7F0]"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">{label}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-[#1a1a1a]/30" /> : <ChevronDown className="h-3.5 w-3.5 text-[#1a1a1a]/30" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          {diffOps ? (
            <p className="text-xs leading-relaxed text-[#1a1a1a]">
              {diffOps.map((op, idx) => {
                if (op.type === 'same')    return <span key={idx}>{op.word}</span>
                if (op.type === 'removed') return <span key={idx} className="rounded bg-red-100 px-0.5 text-red-700 line-through">{op.word}</span>
                return <span key={idx} className="rounded bg-green-100 px-0.5 text-green-800 font-medium">{op.word}</span>
              })}
            </p>
          ) : isEditing ? (
            <textarea
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              rows={3}
              className="w-full resize-none rounded border border-[#1a1a1a]/20 bg-white p-2 text-xs leading-relaxed text-[#1a1a1a] outline-none focus:border-[#FF8A65]"
            />
          ) : (
            <p className="text-xs leading-relaxed text-[#1a1a1a]/70 whitespace-pre-wrap">{value || <span className="italic text-[#1a1a1a]/30">—</span>}</p>
          )}
          {!diffOps && (
            <button
              onClick={onRegen}
              disabled={regenLoading}
              className="mt-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#FF8A65] hover:text-[#e67350] disabled:opacity-40"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              {regenLoading ? 'Regenerating…' : 'Regenerate this section'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Primary section (always visible) ────────────────────────────────────

function PrimarySection({
  label,
  sublabel,
  fieldKey,
  value,
  isEditing,
  editValue,
  onEditChange,
  onRegen,
  regenLoading,
  diffOps,
  mono,
  large,
}: {
  label: string
  sublabel?: string
  fieldKey: string
  value: string
  isEditing: boolean
  editValue: string
  onEditChange: (v: string) => void
  onRegen: () => void
  regenLoading: boolean
  diffOps: DiffOp[] | null
  mono?: boolean
  large?: boolean
}) {
  return (
    <div className="border-t border-[#1a1a1a]/10 px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">{label}</span>
          {sublabel && <span className="text-[9px] text-[#1a1a1a]/30">· {sublabel}</span>}
        </div>
        {!diffOps && (
          <button
            onClick={onRegen}
            disabled={regenLoading}
            title={`Regenerate ${label}`}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#1a1a1a]/30 hover:text-[#FF8A65] disabled:opacity-30 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      {diffOps ? (
        <p className="text-xs leading-relaxed text-[#1a1a1a]">
          {diffOps.map((op, idx) => {
            if (op.type === 'same')    return <span key={idx}>{op.word}</span>
            if (op.type === 'removed') return <span key={idx} className="rounded bg-red-100 px-0.5 text-red-700 line-through">{op.word}</span>
            return <span key={idx} className="rounded bg-green-100 px-0.5 text-green-800 font-medium">{op.word}</span>
          })}
        </p>
      ) : isEditing ? (
        <textarea
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          rows={large ? 6 : 2}
          className={`w-full resize-none rounded border border-[#1a1a1a]/20 bg-white p-2 text-xs leading-relaxed outline-none focus:border-[#FF8A65] ${mono ? 'font-mono text-purple-700' : 'text-[#1a1a1a]'} ${fieldKey === 'title' ? 'font-bold' : ''}`}
        />
      ) : (
        <p className={`text-xs leading-relaxed whitespace-pre-wrap ${mono ? 'font-mono text-purple-700' : 'text-[#1a1a1a]'} ${fieldKey === 'title' ? 'font-semibold text-[#1a1a1a]' : 'text-[#1a1a1a]/80'}`}>
          {value || <span className="italic text-[#1a1a1a]/25">—</span>}
        </p>
      )}
    </div>
  )
}

// ─── Main DeliverableCard ─────────────────────────────────────────────────

interface Props {
  derivative: Derivative
  onUpdate: (updated: Derivative) => void
  momentTitle?: string
}

const PRIMARY_FIELDS: { key: keyof ShortFormDeliverable; label: string; sublabel?: string; large?: boolean; mono?: boolean }[] = [
  { key: 'title',         label: 'Title' },
  { key: 'caption',       label: 'Caption',        sublabel: 'paste into post' },
  { key: 'description',   label: 'Description',    sublabel: 'platform description field' },
  { key: 'spoken_script', label: 'Spoken Script',  sublabel: 'say on camera', large: true },
]

const COLLAPSED_FIELDS: { key: keyof ShortFormDeliverable; label: string }[] = [
  { key: 'why_this_clip',   label: 'Why this clip' },
  { key: 'visual_direction', label: 'Visual direction (AI generators)' },
  { key: 'editor_notes',    label: 'Editor notes (AI editor)' },
]

export function DeliverableCard({ derivative, onUpdate, momentTitle }: Props) {
  const meta = PLATFORM_META[derivative.platform] || { label: derivative.platform, accent: '#999' }
  const deliverable = normalizeDeliverable(derivative)

  // Per-field edit state
  const [editFields, setEditFields] = useState<Partial<ShortFormDeliverable>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [regenField, setRegenField] = useState<string | null>(null)
  const [diffByField, setDiffByField] = useState<Record<string, DiffOp[]>>({})
  const [copied, setCopied] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  function getValue(key: keyof ShortFormDeliverable) {
    return editFields[key] ?? deliverable[key] ?? ''
  }

  function startEdit() {
    setEditFields({ ...deliverable })
    setIsEditing(true)
    setDiffByField({})
  }

  function cancelEdit() {
    setEditFields({})
    setIsEditing(false)
  }

  async function handleSave() {
    setSavingField('all')
    try {
      const newContent = JSON.stringify({ ...deliverable, ...editFields })
      const updated = await api.derivatives.edit(derivative.id, newContent)
      onUpdate(updated)
      setIsEditing(false)
      setEditFields({})
    } finally {
      setSavingField(null)
    }
  }

  async function handleRegenField(fieldKey: string) {
    setRegenField(fieldKey)
    const prevVal = (deliverable as Record<string, string>)[fieldKey] ?? ''
    try {
      const updated = await api.derivatives.regenerate(derivative.id, undefined, fieldKey)
      onUpdate(updated)
      const newDeliverable = normalizeDeliverable(updated)
      const newVal = (newDeliverable as Record<string, string>)[fieldKey] ?? ''
      if (prevVal !== newVal) {
        setDiffByField(prev => ({ ...prev, [fieldKey]: wordDiff(prevVal, newVal) }))
      }
    } finally {
      setRegenField(null)
    }
  }

  async function handleApprove() {
    setLoadingAction('approve')
    try { onUpdate(await api.derivatives.approve(derivative.id)) }
    finally { setLoadingAction(null) }
  }

  async function handleReject() {
    setLoadingAction('reject')
    try { onUpdate(await api.derivatives.reject(derivative.id)) }
    finally { setLoadingAction(null) }
  }

  async function handleCopy() {
    const md = formatDeliverableAsMarkdown(deliverable, derivative.platform, momentTitle)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusBorderColor =
    derivative.status === 'approved' ? 'border-green-400' :
    derivative.status === 'rejected' ? 'border-[#1a1a1a]/20 opacity-60' :
    'border-[#1a1a1a]'

  return (
    <div className={`overflow-hidden rounded-lg border-2 bg-white shadow-[3px_3px_0_#1a1a1a] ${statusBorderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] px-4 py-3"
        style={{ backgroundColor: `${meta.accent}15` }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded" style={{ backgroundColor: meta.accent, color: '#fff' }}>
            <PlatformIcon platform={derivative.platform} />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-[#1a1a1a]">{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {derivative.status === 'approved' && (
            <span className="rounded-full border border-green-400 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">✓ Approved</span>
          )}
          {derivative.status === 'rejected' && (
            <span className="rounded-full border border-[#1a1a1a]/20 bg-[#1a1a1a]/5 px-2 py-0.5 text-[10px] font-bold text-[#1a1a1a]/40">✗ Rejected</span>
          )}
          {derivative.status === 'draft' && (
            <span className="rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-700">Draft</span>
          )}
        </div>
      </div>

      {/* Primary fields */}
      {PRIMARY_FIELDS.map(({ key, label, sublabel, large, mono }) => (
        <PrimarySection
          key={key}
          label={label}
          sublabel={sublabel}
          fieldKey={key}
          value={deliverable[key]}
          isEditing={isEditing}
          editValue={getValue(key)}
          onEditChange={v => setEditFields(prev => ({ ...prev, [key]: v }))}
          onRegen={() => handleRegenField(key)}
          regenLoading={regenField === key}
          diffOps={diffByField[key] ?? null}
          mono={mono}
          large={large}
        />
      ))}

      {/* Hindsight memory banner when diff visible */}
      {Object.keys(diffByField).length > 0 && (
        <div className="flex items-center justify-between border-t border-[#1a1a1a]/10 bg-[#F3E5F5] px-4 py-2">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-[#9575CD]" />
            <span className="text-[10px] font-black uppercase tracking-wider text-[#6A1B9A]">Saved to Persona Memory</span>
          </div>
          <button onClick={() => setDiffByField({})} className="text-[#9575CD]/50 hover:text-[#9575CD]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Collapsed sections */}
      {COLLAPSED_FIELDS.map(({ key, label }) => (
        <CollapsibleSection
          key={key}
          label={label}
          value={deliverable[key]}
          isEditing={isEditing}
          editValue={getValue(key)}
          onEditChange={v => setEditFields(prev => ({ ...prev, [key]: v }))}
          onRegen={() => handleRegenField(key)}
          regenLoading={regenField === key}
          diffOps={diffByField[key] ?? null}
        />
      ))}

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t-2 border-[#1a1a1a] bg-[#FAF7F0] px-4 py-3">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={savingField === 'all'}
                className="btn-xs bg-[#1a1a1a] text-white hover:bg-[#333] border-2 border-[#1a1a1a] px-3 py-1 text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                {savingField === 'all' ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="btn-xs border-2 border-[#1a1a1a] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-[#f0ede5]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="btn-xs border-2 border-[#1a1a1a] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-[#f0ede5] shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#1a1a1a] transition-all"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleCopy}
            className="btn-xs border-2 border-[#1a1a1a] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-[#f0ede5] shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#1a1a1a] transition-all flex items-center gap-1"
          >
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {derivative.status !== 'rejected' && !isEditing && (
            <>
              {derivative.status !== 'approved' && (
                <button
                  onClick={handleApprove}
                  disabled={!!loadingAction}
                  className="btn-xs border-2 border-green-500 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-green-700 hover:bg-green-100 shadow-[2px_2px_0_#16a34a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#16a34a] transition-all disabled:opacity-50"
                >
                  {loadingAction === 'approve' ? '…' : 'Approve'}
                </button>
              )}
              <button
                onClick={handleReject}
                disabled={!!loadingAction}
                className="btn-xs border-2 border-[#1a1a1a]/30 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#1a1a1a]/40 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {loadingAction === 'reject' ? '…' : 'Reject'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

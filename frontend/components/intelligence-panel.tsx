'use client'

import { useState, useEffect, useCallback } from 'react'
import type React from 'react'
import type { MemoryContext } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Brain, Sparkles, Target, ChevronDown, ChevronUp, BookOpen, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'

interface Props {
  memoryContext: MemoryContext | Record<string, never>
  defaultOpen?: boolean
}

/** Strip Hindsight metadata suffixes like "| Involving: Creator | When: 2026-05-20 | To align..." */
function cleanMemoryText(raw: string): string {
  return raw.split(' | ')[0].trim()
}

/** Bucket a memory item into a rough category for the tag pill */
function categorise(text: string): { label: string; color: string } {
  const t = text.toLowerCase()
  if (t.includes('hook') || t.includes('opening'))
    return { label: 'Hook',     color: '#FFD180' }
  if (t.includes('avoid') || t.includes('never') || t.includes('reject') || t.includes('stop doing'))
    return { label: 'Avoid',    color: '#FFCDD2' }
  if (t.includes('tone') || t.includes('voice') || t.includes('conversational') || t.includes('direct') || t.includes('formal'))
    return { label: 'Tone',     color: '#B2EBF2' }
  if (t.includes('platform') || t.includes('linkedin') || t.includes('twitter') || t.includes('instagram') || t.includes('short-form'))
    return { label: 'Platform', color: '#E1BEE7' }
  if (t.includes('prefer') || t.includes('style') || t.includes('niche') || t.includes('audience'))
    return { label: 'Style',    color: '#C8E6C9' }
  if (t.includes('edit') || t.includes('shorten') || t.includes('rewrite') || t.includes('approv') || t.includes('passiv'))
    return { label: 'Editing',  color: '#FFE0B2' }
  return { label: 'Memory',     color: '#F5F5F5' }
}

const PREVIEW_COUNT = 5

/**
 * Minimal markdown renderer — handles ### headings, **bold**, and * bullets.
 * Only processes the patterns Claude actually outputs in reflections.
 */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        // ### Heading
        if (trimmed.startsWith('### ')) {
          return (
            <p key={i} className="mt-3 text-[11px] font-black uppercase tracking-widest text-[#1a1a1a]/50 first:mt-0">
              {trimmed.slice(4)}
            </p>
          )
        }
        // * Bullet or - Bullet
        if (trimmed.match(/^[*-] /)) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9575CD]" />
              <p className="text-sm leading-relaxed text-[#1a1a1a]">{renderInline(trimmed.slice(2))}</p>
            </div>
          )
        }
        // Regular paragraph
        return (
          <p key={i} className="text-sm leading-relaxed text-[#1a1a1a]">
            {renderInline(trimmed)}
          </p>
        )
      })}
    </div>
  )
}

/** Convert **bold** and *italic* inline markers to JSX spans. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-bold text-[#1a1a1a]">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    return part
  })
}

export function IntelligencePanel({ memoryContext, defaultOpen = false }: Props) {
  const [open, setOpen]           = useState(defaultOpen)
  const [showAll, setShowAll]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Live data — starts from the project's stored snapshot, gets overwritten on first open
  const [liveCtx, setLiveCtx] = useState<{
    reflection: string
    recall_count: number
    recall_items: string[]
  } | null>(null)

  const ctx = memoryContext as MemoryContext

  // The values we actually render — prefer live data if available
  const reflection  = liveCtx?.reflection   ?? ctx.reflection   ?? ''
  const recallCount = liveCtx?.recall_count ?? ctx.recall_count ?? 0
  const rawItems    = liveCtx?.recall_items ?? ctx.recall_items ?? []

  const hasMemory   = recallCount > 0
  const cleaned     = rawItems.map(cleanMemoryText).filter(Boolean)
  const visible     = showAll ? cleaned : cleaned.slice(0, PREVIEW_COUNT)
  const hiddenCount = cleaned.length - PREVIEW_COUNT

  const fetchLive = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await api.intelligence.reflect()
      setLiveCtx(data)
    } catch { /* backend unreachable — keep stale */ }
    finally { setRefreshing(false) }
  }, [])

  // Auto-refresh when the panel is opened for the first time
  useEffect(() => {
    if (open && !liveCtx) fetchLive()
  }, [open, liveCtx, fetchLive])

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-white shadow-[4px_4px_0_#1a1a1a]">

      {/* ── Header ── */}
      <div className="flex w-full items-center justify-between bg-white px-5 py-4 transition-colors hover:bg-[#FAF7F0]">
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#9575CD] shadow-[2px_2px_0_#1a1a1a]">
            <Brain className="h-4 w-4 text-[#FAF7F0]" />
          </div>
          <div>
            <span className="text-sm font-black text-[#1a1a1a]">Intelligence Panel</span>
            {hasMemory ? (
              <span className="ml-2.5 inline-flex items-center rounded-full border border-[#1a1a1a]/20 bg-[#E1BEE7] px-2 py-0.5 text-[10px] font-bold text-[#1a1a1a]">
                {recallCount} memories active
              </span>
            ) : (
              <span className="ml-2.5 inline-flex rounded-full border border-[#1a1a1a]/15 bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-semibold text-[#1a1a1a]/50">
                No prior memory
              </span>
            )}
          </div>
          <ChevronDown className={cn(
            'ml-auto h-4 w-4 text-[#1a1a1a]/40 transition-transform duration-200',
            open && 'rotate-180'
          )} />
        </button>
        {/* Manual refresh button */}
        <button
          onClick={e => { e.stopPropagation(); fetchLive() }}
          disabled={refreshing}
          className="ml-3 shrink-0 rounded-lg border border-[#1a1a1a]/15 bg-white p-1.5 text-[#1a1a1a]/40 transition-all hover:border-[#1a1a1a]/40 hover:text-[#1a1a1a] disabled:opacity-40 cursor-pointer"
          title="Refresh synthesis"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-5 border-t-2 border-[#1a1a1a]/10 px-5 pb-5 pt-4">

              {/* ── Creator Synthesis (most useful — first) ── */}
              {reflection && (
                <div className="rounded-xl border-2 border-[#1a1a1a]/10 bg-[#FAF7F0] p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">
                    <Sparkles className="h-3 w-3" />
                    Creator Synthesis
                    {refreshing && <RefreshCw className="ml-1 h-3 w-3 animate-spin opacity-50" />}
                  </p>
                  <MarkdownText text={reflection} />
                </div>
              )}

              {/* ── Recalled Memories ── */}
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">
                  <BookOpen className="h-3 w-3" />
                  Recalled Memories
                  {cleaned.length > 0 && (
                    <span className="ml-1 rounded-full bg-[#1a1a1a]/8 px-1.5 py-0.5 text-[9px] font-black text-[#1a1a1a]/50">
                      {cleaned.length}
                    </span>
                  )}
                </p>

                {hasMemory ? (
                  <div className="space-y-2">
                    {visible.map((item, i) => {
                      const { label, color } = categorise(item)
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 rounded-lg border border-[#1a1a1a]/8 bg-white px-3 py-2.5"
                        >
                          <span
                            className="mt-0.5 shrink-0 rounded-full border border-[#1a1a1a]/15 px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#1a1a1a]"
                            style={{ background: color }}
                          >
                            {label}
                          </span>
                          <p className="text-xs leading-relaxed text-[#1a1a1a]/80">{item}</p>
                        </div>
                      )
                    })}

                    {hiddenCount > 0 && (
                      <button
                        onClick={() => setShowAll(v => !v)}
                        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#1a1a1a]/15 py-2 text-xs font-bold text-[#1a1a1a]/40 transition-colors hover:border-[#1a1a1a]/30 hover:text-[#1a1a1a]/60"
                      >
                        {showAll ? (
                          <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5" /> Show {hiddenCount} more memories</>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg border border-[#1a1a1a]/8 bg-[#FAF7F0] px-3 py-2.5 text-xs leading-relaxed text-[#1a1a1a]/50">
                    No prior memory — generated with universal heuristics. Complete a review to start building creator memory.
                  </p>
                )}
              </div>

              {/* ── Generation Influence ── */}
              <div className="flex items-center gap-3 rounded-xl border-2 border-[#1a1a1a]/10 bg-[#FAF7F0] px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1a1a1a]/15 bg-white">
                  <Target className="h-3.5 w-3.5 text-[#1a1a1a]/60" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">
                    Generation Influence
                  </p>
                  <p className="text-xs font-semibold text-[#1a1a1a]">
                    {recallCount > 0
                      ? `${recallCount} memory-based biases shaped this project's briefs`
                      : 'No memory-based biases applied — first session baseline'}
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

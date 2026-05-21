'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, isCacheWarm } from '@/lib/api'
import { Mascot } from '@/components/mascot'
import type { Project, Derivative } from '@/lib/types'
import { normalizeBrief } from '@/lib/types'
import { motion } from 'framer-motion'
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  ArrowUpRight,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DraftFilter = 'all' | 'draft' | 'approved' | 'rejected'

const FILTERS: { value: DraftFilter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'draft',    label: 'Drafts' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

interface DraftWithContext extends Derivative {
  project_title: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram_reels: 'Instagram Reels',
  youtube_shorts:  'YouTube Shorts',
  linkedin:        'LinkedIn',
  twitter:         'Twitter / X',
  shorts:          'Short-form Video',
  newsletter:      'Newsletter',
}

function parseBriefHook(content: string): { hook: string; angle: string } | null {
  try {
    const raw = JSON.parse(content) as Record<string, unknown>
    const brief = normalizeBrief(raw)
    return { hook: brief.hook, angle: brief.angle }
  } catch {
    return null
  }
}

const STATUS_STYLES: Record<string, { icon: React.ElementType; badge: string }> = {
  draft:    { icon: Clock,        badge: 'bg-white text-[#1a1a1a]/60 border-[#1a1a1a]/15' },
  approved: { icon: CheckCircle2, badge: 'bg-[#C8E6C9] text-[#2E6B33] border-[#1a1a1a]/15' },
  rejected: { icon: XCircle,      badge: 'bg-[#FFCDD2] text-[#C62828] border-[#1a1a1a]/15' },
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftWithContext[]>([])
  const [loading, setLoading] = useState(() => !isCacheWarm('projects/list', 15_000))
  const [filter, setFilter] = useState<DraftFilter>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const projects = await api.projects.list()
        const allDrafts: DraftWithContext[] = []

        const detailed = await Promise.all(
          projects
            .filter(p => p.status === 'ready_for_review' || p.status === 'archived')
            .map(p => api.projects.get(p.id))
        )

        for (const proj of detailed) {
          for (const moment of proj.moments) {
            for (const d of moment.derivatives) {
              allDrafts.push({ ...d, project_title: proj.title })
            }
          }
        }

        // Sort newest first
        allDrafts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setDrafts(allDrafts)
      } catch {
        // API not available
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = filter === 'all'
    ? drafts
    : drafts.filter(d => d.status === filter)

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#FFCDD2]">
          <FileText className="h-5 w-5 text-[#1a1a1a]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Drafts</h1>
          <p className="text-xs font-semibold text-[#1a1a1a]/45">
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''} across all projects
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-[#1a1a1a]/40" />
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full border-2 px-3 py-1 text-xs font-bold transition-all cursor-pointer',
              filter === f.value
                ? 'border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F0] shadow-[2px_2px_0_#FF8A65]'
                : 'border-[#1a1a1a]/15 bg-white text-[#1a1a1a]/60 hover:border-[#1a1a1a]/40'
            )}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1 text-[10px] opacity-70">
                ({drafts.filter(d => d.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border-2 border-[#1a1a1a]/10 bg-white/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border-2 border-dashed border-[#1a1a1a]/20 bg-white/50 py-16 text-center"
        >
          <Mascot className="mx-auto mb-4 h-14 w-14" />
          <p className="text-sm font-black text-[#1a1a1a]">
            {filter === 'all' ? 'No drafts yet' : `No ${filter} drafts`}
          </p>
          <p className="mt-1 text-xs font-medium text-[#1a1a1a]/55">
            {filter === 'all' ? 'Process a video to generate content drafts' : 'Try a different filter'}
          </p>
          {filter === 'all' && (
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-[#1a1a1a] px-5 py-2 text-xs font-bold text-[#FAF7F0] shadow-[3px_3px_0_#FF8A65] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#FF8A65]"
            >
              Go to Dashboard
            </Link>
          )}
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d, i) => {
            const st = STATUS_STYLES[d.status] ?? STATUS_STYLES.draft
            const StatusIcon = st.icon
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}
                className="group rounded-2xl border-2 border-[#1a1a1a]/10 bg-white p-4 transition-all hover:border-[#1a1a1a] hover:shadow-[4px_4px_0_#1a1a1a]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Meta row */}
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/40">
                      <span className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold normal-case', st.badge)}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {d.status}
                      </span>
                      <span className="rounded-full border border-[#1a1a1a]/10 bg-white px-2 py-0.5 normal-case">
                        {d.content_type}
                      </span>
                      <span className="rounded-full border border-[#1a1a1a]/10 bg-white px-2 py-0.5 normal-case">
                        {PLATFORM_LABELS[d.platform] ?? d.platform}
                      </span>
                    </div>
                    {/* Content preview */}
                    {(() => {
                      const brief = parseBriefHook(d.content)
                      if (brief) {
                        return (
                          <div className="space-y-1">
                            <p className="text-sm font-semibold leading-snug text-[#1a1a1a]/85">
                              &ldquo;{brief.hook}&rdquo;
                            </p>
                            {brief.angle && (
                              <p className="line-clamp-2 text-xs leading-relaxed text-[#1a1a1a]/55">
                                {brief.angle}
                              </p>
                            )}
                          </div>
                        )
                      }
                      return (
                        <p className="line-clamp-3 text-sm leading-relaxed text-[#1a1a1a]/75">
                          {d.content}
                        </p>
                      )
                    })()}
                    {/* Project link */}
                    <Link
                      href={`/projects/${d.project_id}`}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#FF8A65] hover:underline"
                    >
                      {d.project_title ?? 'Untitled project'}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                  {/* Copy button */}
                  <button
                    onClick={() => {
                      const brief = parseBriefHook(d.content)
                      handleCopy(brief ? brief.hook : d.content, d.id)
                    }}
                    className="shrink-0 rounded-lg border-2 border-[#1a1a1a]/15 bg-white p-2 text-[#1a1a1a]/50 transition-all hover:border-[#1a1a1a] hover:text-[#1a1a1a] cursor-pointer"
                    title="Copy content"
                  >
                    {copiedId === d.id ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

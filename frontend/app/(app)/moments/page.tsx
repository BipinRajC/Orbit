'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { api, isCacheWarm } from '@/lib/api'
import { Mascot } from '@/components/mascot'
import type { Project, Moment } from '@/lib/types'
import { motion } from 'framer-motion'
import {
  Layers,
  Zap,
  Play,
  ArrowUpRight,
  Filter,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MomentWithProject extends Moment {
  project_title: string | null
  project_source_url: string
}

interface ProjectOption {
  id: string
  title: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

type SortMode = 'strength' | 'chronological'

export default function MomentsPage() {
  const [moments, setMoments]         = useState<MomentWithProject[]>([])
  const [projects, setProjects]       = useState<ProjectOption[]>([])
  const [loading, setLoading]         = useState(() => !isCacheWarm('projects/list', 15_000))
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [sort, setSort]               = useState<SortMode>('strength')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const projectList = await api.projects.list()
        const ready = projectList.filter(
          p => p.status === 'ready_for_review' || p.status === 'archived'
        )
        const detailed = await Promise.all(ready.map(p => api.projects.get(p.id)))

        const allMoments: MomentWithProject[] = []
        const projectOptions: ProjectOption[] = []

        for (const proj of detailed) {
          if (proj.moments.length > 0) {
            projectOptions.push({ id: proj.id, title: proj.title ?? 'Untitled project' })
          }
          for (const moment of proj.moments) {
            allMoments.push({
              ...moment,
              project_title: proj.title,
              project_source_url: proj.source_url,
            })
          }
        }

        setProjects(projectOptions)
        setMoments(allMoments)
      } catch {
        // API not available
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const base = selectedProject === 'all'
      ? moments
      : moments.filter(m => m.project_id === selectedProject)

    return [...base].sort((a, b) =>
      sort === 'strength'
        ? b.strength_score - a.strength_score
        : a.start_timestamp - b.start_timestamp
    )
  }, [moments, selectedProject, sort])

  const selectedLabel = selectedProject === 'all'
    ? 'All videos'
    : projects.find(p => p.id === selectedProject)?.title ?? 'All videos'

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#C8E6C9]">
          <Layers className="h-5 w-5 text-[#1a1a1a]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Moments</h1>
          <p className="text-xs font-semibold text-[#1a1a1a]/45">
            {filtered.length} moment{filtered.length !== 1 ? 's' : ''}
            {selectedProject !== 'all' ? ' in selected video' : ' across all projects'}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      {!loading && moments.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Filter className="h-3.5 w-3.5 shrink-0 text-[#1a1a1a]/40" />

          {/* Project dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-2 rounded-full border-2 border-[#1a1a1a]/15 bg-white px-3 py-1 text-xs font-bold text-[#1a1a1a]/70 transition-all hover:border-[#1a1a1a]/40 cursor-pointer"
            >
              <span className="max-w-[180px] truncate">{selectedLabel}</span>
              <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', dropdownOpen && 'rotate-180')} />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[4px_4px_0_#1a1a1a]">
                {[{ id: 'all', title: 'All videos' }, ...projects].map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProject(p.id); setDropdownOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold transition-colors hover:bg-[#FAF7F0]',
                      selectedProject === p.id ? 'text-[#FF8A65]' : 'text-[#1a1a1a]'
                    )}
                  >
                    {selectedProject === p.id && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8A65]" />}
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort chips */}
          <div className="flex items-center gap-1.5 rounded-full border-2 border-[#1a1a1a]/10 bg-white p-0.5">
            {([['strength', 'Top strength'], ['chronological', 'Chronological']] as [SortMode, string][]).map(
              ([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setSort(mode)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[10px] font-bold transition-all cursor-pointer',
                    sort === mode
                      ? 'bg-[#1a1a1a] text-[#FAF7F0] shadow-[1px_1px_0_#1a1a1a]'
                      : 'text-[#1a1a1a]/50 hover:text-[#1a1a1a]'
                  )}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border-2 border-[#1a1a1a]/10 bg-white/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border-2 border-dashed border-[#1a1a1a]/20 bg-white/50 py-16 text-center"
        >
          <Mascot className="mx-auto mb-4 h-14 w-14" />
          <p className="text-sm font-black text-[#1a1a1a]">No moments yet</p>
          <p className="mt-1 text-xs font-medium text-[#1a1a1a]/55">Process a video to extract moments</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-[#1a1a1a] px-5 py-2 text-xs font-bold text-[#FAF7F0] shadow-[3px_3px_0_#FF8A65] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#FF8A65]"
          >
            Go to Dashboard
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}
            >
              <Link
                href={`/projects/${m.project_id}`}
                className="group flex gap-4 rounded-2xl border-2 border-[#1a1a1a]/10 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#1a1a1a] hover:shadow-[4px_4px_0_#1a1a1a]"
              >
                {/* Strength score badge */}
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#FFD180]">
                  <Zap className="h-3.5 w-3.5 text-[#1a1a1a]" />
                  <span className="text-sm font-black text-[#1a1a1a]">
                    {Math.round(m.strength_score * 100)}%
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#1a1a1a]">
                        {m.project_title ?? 'Untitled project'}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-[#1a1a1a]/45">
                        <Play className="mr-1 inline h-3 w-3" />
                        {formatTime(m.start_timestamp)} – {formatTime(m.end_timestamp)}
                        <span className="mx-2 text-[#1a1a1a]/20">·</span>
                        {m.derivatives.length > 0
                          ? `${m.derivatives.length} platform brief${m.derivatives.length !== 1 ? 's' : ''}`
                          : 'no briefs yet'}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#1a1a1a]/30 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1a1a1a]" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#1a1a1a]/60">
                    {m.transcript_snippet}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, isCacheWarm } from '@/lib/api'
import { Mascot } from '@/components/mascot'
import type { Project, Moment } from '@/lib/types'
import { motion } from 'framer-motion'
import {
  Layers,
  Clock,
  Zap,
  Play,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MomentWithProject extends Moment {
  project_title: string | null
  project_source_url: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MomentsPage() {
  const [moments, setMoments] = useState<MomentWithProject[]>([])
  const [loading, setLoading] = useState(() => !isCacheWarm('projects/list', 15_000))

  useEffect(() => {
    async function load() {
      try {
        const projects = await api.projects.list()
        const allMoments: MomentWithProject[] = []

        // Fetch full project details for each ready project to get moments
        const detailed = await Promise.all(
          projects
            .filter(p => p.status === 'ready_for_review' || p.status === 'archived')
            .map(p => api.projects.get(p.id))
        )

        for (const proj of detailed) {
          for (const moment of proj.moments) {
            allMoments.push({
              ...moment,
              project_title: proj.title,
              project_source_url: proj.source_url,
            })
          }
        }

        // Sort by strength score descending
        allMoments.sort((a, b) => b.strength_score - a.strength_score)
        setMoments(allMoments)
      } catch {
        // API not available
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#C8E6C9]">
          <Layers className="h-5 w-5 text-[#1a1a1a]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Moments</h1>
          <p className="text-xs font-semibold text-[#1a1a1a]/45">
            {moments.length} moment{moments.length !== 1 ? 's' : ''} across all projects
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border-2 border-[#1a1a1a]/10 bg-white/50" />
          ))}
        </div>
      ) : moments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border-2 border-dashed border-[#1a1a1a]/20 bg-white/50 py-16 text-center"
        >
          <Mascot className="mx-auto mb-4 h-14 w-14" />
          <p className="text-sm font-black text-[#1a1a1a]">No moments yet</p>
          <p className="mt-1 text-xs font-medium text-[#1a1a1a]/55">
            Process a video to extract moments
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-[#1a1a1a] px-5 py-2 text-xs font-bold text-[#FAF7F0] shadow-[3px_3px_0_#FF8A65] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#FF8A65]"
          >
            Go to Dashboard
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {moments.map((m, i) => (
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
                  <span className="text-sm font-black text-[#1a1a1a]">{m.strength_score}</span>
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

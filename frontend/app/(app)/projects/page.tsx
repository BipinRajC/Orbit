'use client'

import { useEffect, useState } from 'react'
import { ProjectCard } from '@/components/project-card'
import { UploadInput } from '@/components/upload-input'
import { Mascot } from '@/components/mascot'
import { api } from '@/lib/api'
import type { ProjectListItem } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FolderOpen,
  Clock,
  Sparkles,
  Video,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'processing' | 'ready_for_review' | 'archived'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all',              label: 'All' },
  { value: 'processing',      label: 'Processing' },
  { value: 'ready_for_review', label: 'Ready' },
  { value: 'archived',        label: 'Reviewed' },
]

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')

  async function fetchProjects() {
    try {
      const data = await api.projects.list()
      setProjects(data)
    } catch {
      // API not available
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  const filtered = filter === 'all'
    ? projects
    : projects.filter(p => p.status === filter)

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#FFD180]">
            <FolderOpen className="h-5 w-5 text-[#1a1a1a]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1a1a1a]">All Projects</h1>
            <p className="text-xs font-semibold text-[#1a1a1a]/45">
              {projects.length} project{projects.length !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
      </div>

      {/* Upload area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border-2 border-[#1a1a1a] bg-white p-5 shadow-[4px_4px_0_#FF8A65]"
      >
        <div className="mb-3 flex items-center gap-2">
          <Video className="h-4 w-4 text-[#1a1a1a]/60" />
          <span className="text-sm font-bold text-[#1a1a1a]">New project</span>
        </div>
        <UploadInput onProjectCreated={(id) => router.push(`/projects/${id}`)} />
      </motion.div>

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
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
                ({projects.filter(p => p.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[112px] animate-pulse rounded-2xl border-2 border-[#1a1a1a]/10 bg-white/50" />
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
            {filter === 'all' ? 'No projects yet' : `No ${FILTERS.find(f => f.value === filter)?.label.toLowerCase()} projects`}
          </p>
          <p className="mt-1 text-xs font-medium text-[#1a1a1a]/55">
            {filter === 'all' ? 'Paste a YouTube URL above to create your first one' : 'Try a different filter'}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
            >
              <ProjectCard project={p} onDelete={fetchProjects} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

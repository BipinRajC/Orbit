'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MomentGroup } from '@/components/moment-group'
import { ProgressStream } from '@/components/progress-stream'
import { IntelligencePanel } from '@/components/intelligence-panel'
import { CostPanel } from '@/components/cost-panel'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Layers,
  ChevronDown,
  Archive,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 3000

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoriesSaved, setMemoriesSaved] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchProject() {
    try {
      const data = await api.projects.get(id)
      setProject(data)
      if (data.status !== 'processing' && data.status !== 'uploaded') {
        stopPolling()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
      stopPolling()
    } finally {
      setLoading(false)
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    fetchProject()
    pollRef.current = setInterval(fetchProject, POLL_INTERVAL_MS)
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleCompleteReview() {
    if (!project) return
    setCompleting(true)
    try {
      const result = await api.projects.completeReview(project.id)
      setMemoriesSaved(result.observations_saved ?? 0)
      await fetchProject()
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
        <span className="text-sm text-zinc-500">Loading project...</span>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-400 mb-3">{error ?? 'Project not found'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="btn-xs btn-ghost inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3 w-3" /> Back to projects
        </button>
      </div>
    )
  }

  const isProcessing = project.status === 'processing' || project.status === 'uploaded'
  const isReady = project.status === 'ready_for_review'
  const isArchived = project.status === 'archived'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3 w-3" />
          Projects
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              {project.title ?? 'Processing...'}
            </h1>
            <a
              href={project.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
            >
              {project.source_url}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {isReady && (
            <button
              onClick={handleCompleteReview}
              disabled={completing}
              className="shrink-0 flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
            >
              {completing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Synthesising...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Complete Review
                </>
              )}
            </button>
          )}

          {isArchived && (
            <div className="flex items-center gap-2">
              {memoriesSaved !== null && (
                <span className="shrink-0 flex items-center gap-1.5 rounded-full border-2 border-[#1a1a1a]/20 bg-[#E1BEE7] px-3 py-1.5 text-xs font-bold text-[#1a1a1a]">
                  ✦ {memoriesSaved} memories saved to Hindsight
                </span>
              )}
              <span className="shrink-0 flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                <Archive className="h-3 w-3" />
                Review complete
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Processing state */}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ProgressStream log={project.processing_log} status={project.status} />
        </motion.div>
      )}

      {/* Intelligence + Cost panels */}
      {!isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <IntelligencePanel memoryContext={project.memory_context} defaultOpen={true} />
          <CostPanel costLog={project.cost_log} defaultOpen={true} />
        </motion.div>
      )}

      {/* Moments + derivatives */}
      {project.moments.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-zinc-500" />
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {project.moments.length} moment{project.moments.length !== 1 ? 's' : ''} extracted
            </h2>
            <span className="text-[10px] font-semibold text-zinc-600 border border-zinc-700 rounded-full px-2 py-0.5">
              7 moments · 1 per day of the week
            </span>
          </div>
          {project.moments.map((moment, i) => (
            <MomentGroup key={moment.id} moment={moment} index={i} sourceUrl={project.source_url} />
          ))}
        </div>
      ) : !isProcessing ? (
        <div className="rounded-xl border border-dashed border-zinc-700 py-16 text-center">
          <Layers className="mx-auto h-8 w-8 text-zinc-600 mb-3" />
          <p className="text-sm text-zinc-500">No moments were extracted.</p>
        </div>
      ) : null}

      {/* Pipeline log (collapsed when done) */}
      {!isProcessing && project.processing_log.length > 0 && (
        <details className="group rounded-xl border border-zinc-800 bg-card">
          <summary className="flex cursor-pointer items-center justify-between p-4 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            <span>Processing log</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            <ProgressStream log={project.processing_log} status={project.status} />
          </div>
        </details>
      )}
    </motion.div>
  )
}

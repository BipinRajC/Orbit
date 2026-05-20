'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MomentGroup } from '@/components/moment-group'
import { ProgressStream } from '@/components/progress-stream'
import { IntelligencePanel } from '@/components/intelligence-panel'
import { CostPanel } from '@/components/cost-panel'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'

const POLL_INTERVAL_MS = 3000

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchProject() {
    try {
      const data = await api.projects.get(id)
      setProject(data)
      // Stop polling once processing is done
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
    // Start polling — stops automatically when processing ends
    pollRef.current = setInterval(fetchProject, POLL_INTERVAL_MS)
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleCompleteReview() {
    if (!project) return
    setCompleting(true)
    try {
      await api.projects.completeReview(project.id)
      await fetchProject()
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading project...</p>
  }

  if (error || !project) {
    return (
      <div>
        <p className="text-sm text-red-500">{error ?? 'Project not found'}</p>
        <button onClick={() => router.push('/')} className="mt-2 text-xs text-zinc-400 underline">
          Back to projects
        </button>
      </div>
    )
  }

  const isProcessing = project.status === 'processing' || project.status === 'uploaded'
  const isReady = project.status === 'ready_for_review'
  const isArchived = project.status === 'archived'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/')}
            className="mb-1 text-xs text-zinc-400 hover:text-zinc-600"
          >
            ← Projects
          </button>
          <h1 className="text-xl font-semibold text-zinc-900">
            {project.title ?? 'Processing...'}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">{project.source_url}</p>
        </div>
        {isReady && (
          <button
            onClick={handleCompleteReview}
            disabled={completing}
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {completing ? 'Synthesising...' : 'Complete Review'}
          </button>
        )}
        {isArchived && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
            Review complete
          </span>
        )}
      </div>

      {/* Processing state */}
      {isProcessing && (
        <ProgressStream log={project.processing_log} status={project.status} />
      )}

      {/* Intelligence + Cost panels — always shown once pipeline ran */}
      {!isProcessing && (
        <div className="grid gap-4 sm:grid-cols-2">
          <IntelligencePanel
            memoryContext={project.memory_context}
            defaultOpen={true}
          />
          <CostPanel
            costLog={project.cost_log}
            defaultOpen={true}
          />
        </div>
      )}

      {/* Moments + derivatives */}
      {project.moments.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
            {project.moments.length} moments
          </h2>
          {project.moments.map((moment, i) => (
            <MomentGroup key={moment.id} moment={moment} index={i} />
          ))}
        </div>
      ) : !isProcessing ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center">
          <p className="text-sm text-zinc-400">No moments were extracted.</p>
        </div>
      ) : null}

      {/* Pipeline log (collapsed by default when ready) */}
      {!isProcessing && project.processing_log.length > 0 && (
        <details className="rounded-lg border border-zinc-200">
          <summary className="cursor-pointer p-3 text-xs font-medium text-zinc-400 hover:text-zinc-600">
            Processing log
          </summary>
          <div className="px-3 pb-3">
            <ProgressStream log={project.processing_log} status={project.status} />
          </div>
        </details>
      )}
    </div>
  )
}

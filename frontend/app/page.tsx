'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadInput } from '@/components/upload-input'
import { ProjectCard } from '@/components/project-card'
import { api } from '@/lib/api'
import type { ProjectListItem } from '@/lib/types'

export default function HomePage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchProjects() {
    try {
      const data = await api.projects.list()
      setProjects(data)
    } catch {
      // API not available yet — show empty state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  function handleProjectCreated(id: string) {
    router.push(`/projects/${id}`)
  }

  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Creator OS
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a podcast or video — get creator-voiced hooks, tweets, and clip framing.
          The system learns from how you edit.
        </p>
      </div>

      {/* Upload */}
      <div className="mb-10 rounded-xl border border-zinc-200 bg-white p-6">
        <p className="mb-3 text-sm font-medium text-zinc-700">Process a YouTube video</p>
        <UploadInput onProjectCreated={handleProjectCreated} />
      </div>

      {/* Project list */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-zinc-500 uppercase tracking-wide">
          Projects
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading...</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center">
            <p className="text-sm text-zinc-400">No projects yet. Paste a YouTube URL above to start.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

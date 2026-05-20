'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { PlatformSelector, type Platform } from './platform-selector'

const ALL_PLATFORMS: Platform[] = ['instagram_reels', 'youtube_shorts', 'linkedin']

interface Props {
  onProjectCreated: (projectId: string) => void
}

export function UploadInput({ onProjectCreated }: Props) {
  const [url, setUrl] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>(ALL_PLATFORMS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError(null)

    try {
      const project = await api.projects.create(url.trim(), platforms)
      setUrl('')
      onProjectCreated(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste a YouTube URL..."
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-0 disabled:opacity-50"
        />
        <PlatformSelector
          selected={platforms}
          onChange={setPlatforms}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim() || platforms.length === 0}
          className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Processing...' : 'Process'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
    </form>
  )
}

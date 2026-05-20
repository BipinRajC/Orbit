'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { PlatformSelector, type Platform } from './platform-selector'

const ALL_PLATFORMS: Platform[] = ['instagram_reels', 'youtube_shorts', 'linkedin']

const GOALS = [
  { value: 'grow_followers', label: 'Grow followers' },
  { value: 'inspire', label: 'Inspire audience' },
  { value: 'teach_skill', label: 'Teach a skill' },
  { value: 'build_trust', label: 'Build trust' },
]

interface Props {
  onProjectCreated: (projectId: string) => void
}

export function UploadInput({ onProjectCreated }: Props) {
  const [url, setUrl] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>(ALL_PLATFORMS)
  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError(null)

    try {
      const videoIntent = (topic.trim() || goal) ? { topic: topic.trim(), goal } : undefined
      const project = await api.projects.create(url.trim(), platforms, videoIntent)
      setUrl('')
      setTopic('')
      setGoal('')
      onProjectCreated(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      {/* URL + Process row */}
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

      {/* Video intent — optional */}
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 space-y-2.5">
        <p className="text-xs font-medium text-zinc-500">Video intent (optional — helps the AI pick better moments)</p>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="What's this video about? e.g. 30-min full body workout for beginners"
          disabled={loading}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 disabled:opacity-50"
        />
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map(g => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoal(goal === g.value ? '' : g.value)}
              disabled={loading}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                goal === g.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </form>
  )
}

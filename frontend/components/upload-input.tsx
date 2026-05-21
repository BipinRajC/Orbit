'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { PlatformSelector, type Platform } from './platform-selector'

const PLACEHOLDER_EXAMPLES = [
  'youtube.com/watch?v=dQw4w9WgXcQ',
  'Drop a podcast, keynote, or interview...',
  'youtu.be/jNQXAC9IVRw',
  'Any public YouTube URL works',
  'youtube.com/@mkbhd/videos',
  'Turn a long video into a week of content',
]

function useTypingPlaceholder(active: boolean) {
  const [display, setDisplay] = useState('')
  const [cursor, setCursor] = useState(true)
  const indexRef  = useRef(0)
  const charRef   = useRef(0)
  const phaseRef  = useRef<'typing' | 'hold' | 'deleting'>('typing')
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) { setDisplay(''); return }

    function tick() {
      const word = PLACEHOLDER_EXAMPLES[indexRef.current]
      const phase = phaseRef.current

      if (phase === 'typing') {
        charRef.current += 1
        setDisplay(word.slice(0, charRef.current))
        if (charRef.current >= word.length) {
          phaseRef.current = 'hold'
          timerRef.current = setTimeout(tick, 1800)
        } else {
          timerRef.current = setTimeout(tick, 48)
        }
      } else if (phase === 'hold') {
        phaseRef.current = 'deleting'
        timerRef.current = setTimeout(tick, 80)
      } else {
        charRef.current -= 1
        setDisplay(word.slice(0, charRef.current))
        if (charRef.current <= 0) {
          indexRef.current = (indexRef.current + 1) % PLACEHOLDER_EXAMPLES.length
          phaseRef.current = 'typing'
          timerRef.current = setTimeout(tick, 400)
        } else {
          timerRef.current = setTimeout(tick, 28)
        }
      }
    }

    timerRef.current = setTimeout(tick, 600)

    // Blinking cursor
    const cursorInterval = setInterval(() => setCursor(c => !c), 530)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      clearInterval(cursorInterval)
    }
  }, [active])

  return { display, cursor }
}

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
  const [inputFocused, setInputFocused] = useState(false)

  const { display: typedPlaceholder, cursor: showCursor } = useTypingPlaceholder(!url && !inputFocused)

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
        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={loading}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-0 disabled:opacity-50"
          />
          {/* Animated placeholder — only shown when input is empty and unfocused */}
          {!url && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center px-4"
              aria-hidden="true"
            >
              <span className="text-sm text-zinc-400 truncate">
                {inputFocused
                  ? 'Paste a YouTube URL…'
                  : typedPlaceholder || 'Paste a YouTube URL…'}
                {!inputFocused && typedPlaceholder && (
                  <span
                    className={`ml-px inline-block w-[1.5px] h-[14px] align-middle bg-zinc-400 transition-opacity duration-100 ${showCursor ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}
              </span>
            </div>
          )}
        </div>
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

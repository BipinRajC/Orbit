'use client'

import { useRef, useState } from 'react'

interface Props {
  clipUrl: string | null       // e.g. /api/clips/{project_id}/{moment_id}.mp4
  fallbackYouTubeUrl?: string  // source YouTube URL for embed fallback
  startSeconds?: number
  endSeconds?: number
}

export function VideoPlayer({ clipUrl, fallbackYouTubeUrl, startSeconds = 0, endSeconds }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)

  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'
  const fullClipUrl = clipUrl ? `${API_BASE}${clipUrl}` : null

  // Build YouTube embed fallback URL with timestamps
  function buildYouTubeEmbed(url: string): string | null {
    try {
      const u = new URL(url)
      let videoId = u.searchParams.get('v')
      if (!videoId) {
        // Handle youtu.be/ID format
        const match = u.pathname.match(/\/([a-zA-Z0-9_-]{11})/)
        videoId = match?.[1] ?? null
      }
      if (!videoId) return null
      const params = new URLSearchParams({ start: String(Math.floor(startSeconds)) })
      if (endSeconds) params.set('end', String(Math.floor(endSeconds)))
      return `https://www.youtube.com/embed/${videoId}?${params}`
    } catch {
      return null
    }
  }

  // Show native player if clip available and no error
  if (fullClipUrl && !error) {
    return (
      <div className="flex justify-center">
        <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '9/16', width: '180px' }}>
          <video
            ref={videoRef}
            src={fullClipUrl}
            controls
            playsInline
            className="h-full w-full object-cover"
            onError={() => setError(true)}
          />
        </div>
      </div>
    )
  }

  // Fallback: YouTube embed with timestamps
  if (fallbackYouTubeUrl) {
    const embedUrl = buildYouTubeEmbed(fallbackYouTubeUrl)
    if (embedUrl) {
      return (
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-xl bg-black"
            style={{ aspectRatio: '9/16', width: '180px' }}
          >
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video clip"
            />
          </div>
        </div>
      )
    }
  }

  // No clip, no fallback
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400"
      style={{ aspectRatio: '9/16', width: '180px', margin: '0 auto' }}
    >
      Clip unavailable
    </div>
  )
}

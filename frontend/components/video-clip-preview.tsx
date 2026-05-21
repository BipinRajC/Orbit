'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

interface Props {
  sourceUrl: string
  startSeconds: number
  endSeconds: number
  /** Optional pre-extracted clip URL.
   *  - If it starts with `/api/` → serve from backend as <video>
   *  - If it's a youtube.com/embed URL → use it directly as an iframe
   *  - Otherwise fall back to constructing the embed from sourceUrl + timestamps
   */
  clipUrl?: string | null
  /** Required for the "Export as 9:16" button */
  projectId?: string
  momentId?: string
}

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractVideoId(url: string): string | null {
  // youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]
  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]
  // youtube.com/embed/ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]
  return null
}

export function VideoClipPreview({
  sourceUrl,
  startSeconds,
  endSeconds,
  clipUrl,
  projectId,
  momentId,
}: Props) {
  const start = Math.floor(startSeconds)
  const end   = Math.ceil(endSeconds)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExportVertical() {
    if (!projectId || !momentId) return
    setExporting(true)
    setExportError(null)
    try {
      const { url } = await api.clips.exportVertical(projectId, momentId)
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api$/, '')
      const absoluteUrl = url.startsWith('http') ? url : `${apiBase}${url}`
      // Trigger browser download
      const a = document.createElement('a')
      a.href = absoluteUrl
      a.download = `clip_9x16_${momentId}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      setExportError('Export failed — try again')
    } finally {
      setExporting(false)
    }
  }

  const exportButton = projectId && momentId ? (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={handleExportVertical}
        disabled={exporting}
        className="rounded-lg border-2 border-[#1a1a1a] bg-[#FF8A65] px-4 py-1.5 text-xs font-black text-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
      >
        {exporting ? 'Exporting…' : 'Export as 9:16'}
      </button>
      {exportError && (
        <span className="text-xs font-medium text-red-600">{exportError}</span>
      )}
    </div>
  ) : null

  // --- Determine what to render ---

  // 1. Server-extracted MP4 clip (source aspect)
  if (clipUrl?.startsWith('/api/')) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api$/, '')
    const absoluteUrl = `${apiBase}${clipUrl}`
    return (
      <div className="overflow-hidden rounded-xl border-2 border-[#1a1a1a] bg-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-bold text-white/70">Extracted clip</span>
          <span className="font-mono text-[10px] text-white/40">
            {formatTimestamp(startSeconds)} — {formatTimestamp(endSeconds)}
          </span>
        </div>
        {/* Source-aspect video container — 16:9 for landscape YouTube source */}
        <div className="w-full max-w-2xl mx-auto">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <video
              src={absoluteUrl}
              controls
              playsInline
              className="absolute inset-0 h-full w-full object-contain bg-[#1a1a1a]"
            />
          </div>
        </div>
        {exportButton}
      </div>
    )
  }

  // 2. Already a YouTube embed URL (stored fallback from backend)
  if (clipUrl?.includes('youtube.com/embed/')) {
    return (
      <div className="overflow-hidden rounded-xl border-2 border-[#1a1a1a] bg-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-bold text-white/70">Source clip</span>
          <span className="font-mono text-[10px] text-white/40">
            {formatTimestamp(startSeconds)} — {formatTimestamp(endSeconds)}
          </span>
        </div>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={clipUrl}
            title="Source video clip"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {exportButton}
      </div>
    )
  }

  // 3. Fallback — construct YouTube embed from sourceUrl + timestamps
  const videoId = extractVideoId(sourceUrl)
  if (!videoId) return null

  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${start}&end=${end}&rel=0&modestbranding=1`

  return (
    <div className="overflow-hidden rounded-xl border-2 border-[#1a1a1a] bg-[#1a1a1a]">
      {/* Label */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-bold text-white/70">
          Source clip
        </span>
        <span className="font-mono text-[10px] text-white/40">
          {formatTimestamp(startSeconds)} — {formatTimestamp(endSeconds)}
        </span>
      </div>
      {/* 16:9 embed */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embedUrl}
          title="Source video clip"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {exportButton}
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

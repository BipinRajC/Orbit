'use client'

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

export function VideoClipPreview({ sourceUrl, startSeconds, endSeconds, clipUrl }: Props) {
  const start = Math.floor(startSeconds)
  const end   = Math.ceil(endSeconds)

  // --- Determine what to render ---

  // 1. Server-extracted 9:16 MP4 clip
  if (clipUrl?.startsWith('/api/')) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/api$/, '')
    const absoluteUrl = `${apiBase}${clipUrl}`
    return (
      <div className="overflow-hidden rounded-xl border-2 border-[#1a1a1a] bg-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-bold text-white/70">Extracted clip (9:16)</span>
          <span className="font-mono text-[10px] text-white/40">
            {formatTimestamp(startSeconds)} — {formatTimestamp(endSeconds)}
          </span>
        </div>
        <div className="flex justify-center bg-[#1a1a1a] py-3">
          <video
            src={absoluteUrl}
            controls
            playsInline
            className="mx-auto block max-h-[480px] w-auto"
          />
        </div>
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
      {/* Embed */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embedUrl}
          title="Source video clip"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

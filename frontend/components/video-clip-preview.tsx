'use client'

interface Props {
  sourceUrl: string
  startSeconds: number
  endSeconds: number
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

export function VideoClipPreview({ sourceUrl, startSeconds, endSeconds }: Props) {
  const videoId = extractVideoId(sourceUrl)
  if (!videoId) return null

  const start = Math.floor(startSeconds)
  const end = Math.ceil(endSeconds)

  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${start}&end=${end}&rel=0&modestbranding=1`

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-black">
      {/* Label */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2">
        <span className="text-xs font-medium text-zinc-300">
          Source clip
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
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

'use client'

import { useState, useRef, useEffect } from 'react'

export type Platform = 'instagram_reels' | 'youtube_shorts' | 'linkedin'

const PLATFORMS: { value: Platform; label: string; icon: string }[] = [
  { value: 'instagram_reels', label: 'Instagram Reels', icon: '◎' },
  { value: 'youtube_shorts', label: 'YouTube Shorts', icon: '▶' },
  { value: 'linkedin',       label: 'LinkedIn',        icon: '◆' },
]

interface Props {
  selected: Platform[]
  onChange: (platforms: Platform[]) => void
  disabled?: boolean
}

export function PlatformSelector({ selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(platform: Platform) {
    if (selected.includes(platform)) {
      // Must keep at least one selected
      if (selected.length === 1) return
      onChange(selected.filter(p => p !== platform))
    } else {
      onChange([...selected, platform])
    }
  }

  const label =
    selected.length === PLATFORMS.length
      ? 'All platforms'
      : selected.length === 0
      ? 'No platforms'
      : selected
          .map(v => PLATFORMS.find(p => p.value === v)?.icon)
          .filter(Boolean)
          .join(' ') + ` (${selected.length})`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 outline-none transition-colors hover:border-zinc-400 disabled:opacity-50"
      >
        <span className="text-xs font-medium text-zinc-500">Platforms:</span>
        <span className="font-medium">{label}</span>
        <span className="ml-1 text-zinc-400">{open ? '▲' : '▾'}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-zinc-200 bg-white shadow-lg">
          {PLATFORMS.map(({ value, label: name, icon }) => {
            const checked = selected.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-zinc-50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
                    checked
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-300 text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span className="text-zinc-500">{icon}</span>
                <span className="text-zinc-700">{name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

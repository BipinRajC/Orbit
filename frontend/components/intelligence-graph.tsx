'use client'

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { motion } from 'framer-motion'
import { Brain, Sparkles, GitBranch, Pencil, RefreshCw, LayoutGrid, Clock, Share2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { IntelligenceGraph, GraphNode, GraphNodeKind } from '@/lib/types'
import { cn } from '@/lib/utils'

type ViewMode = 'graph' | 'table' | 'timeline'

interface Props {
  projectId: string
  /** Platform context used to personalize the panel header copy. */
  platform?: 'twitter' | 'linkedin' | 'shorts' | 'newsletter' | null
}

const KIND_COLORS: Record<GraphNodeKind, { fill: string; stroke: string; text: string }> = {
  root: { fill: '#1a1a1a', stroke: '#1a1a1a', text: '#FAF7F0' },
  trait: { fill: '#FFD180', stroke: '#1a1a1a', text: '#1a1a1a' },
  platform: { fill: '#9575CD', stroke: '#1a1a1a', text: '#FAF7F0' },
  preference: { fill: '#FF8A65', stroke: '#1a1a1a', text: '#1a1a1a' },
  topic: { fill: '#A5D6A7', stroke: '#1a1a1a', text: '#1a1a1a' },
}

const PLATFORM_HEADERS: Record<string, { title: string; sub: string }> = {
  twitter: {
    title: 'Optimizing for Twitter threads',
    sub: 'Shorter hooks · zero emoji · contrarian framing',
  },
  linkedin: {
    title: 'Optimizing for LinkedIn posts',
    sub: 'Story-first openings · spaced paragraphs · 1 CTA',
  },
  shorts: {
    title: 'Optimizing for short-form video',
    sub: 'First-2-second hook · visual framing · 30s pacing',
  },
  newsletter: {
    title: 'Optimizing for newsletter',
    sub: 'Conversational lede · long-form structure · subhead breaks',
  },
}

const DEFAULT_HEADER = {
  title: 'What OrbitOS knows about your persona',
  sub: 'A live map of memories, traits, and learned preferences',
}

export function IntelligenceGraph({ projectId, platform = null }: Props) {
  const [graph, setGraph] = useState<IntelligenceGraph | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('graph')
  const [activeKinds, setActiveKinds] = useState<Set<GraphNodeKind>>(new Set())

  function toggleKind(kind: GraphNodeKind) {
    setActiveKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  // Filtered nodes: always include root; if no filter active show all
  const filteredNodes = useMemo(() => {
    if (!graph) return []
    if (activeKinds.size === 0) return graph.nodes
    return graph.nodes.filter(n => n.kind === 'root' || activeKinds.has(n.kind))
  }, [graph, activeKinds])

  const filteredIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])

  const filteredEdges = useMemo(() => {
    if (!graph) return []
    return graph.edges.filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))
  }, [graph, filteredIds])

  async function load() {
    setLoading(true)
    try {
      const g = await api.intelligence.graph(projectId)
      setGraph(g)
    } catch {
      // backend offline — fall back to placeholder shape so the UI still renders
      setGraph({
        project_id: projectId,
        nodes: [
          { id: 'creator', label: 'Creator Persona', kind: 'root', weight: 1 },
          { id: 'tone-direct', label: 'Direct tone', kind: 'trait', weight: 0.72 },
          { id: 'tone-warm', label: 'Warm phrasing', kind: 'trait', weight: 0.61 },
          { id: 'platform-twitter', label: 'Twitter', kind: 'platform', weight: 0.85 },
          { id: 'platform-shorts', label: 'Short-form', kind: 'platform', weight: 0.55 },
          { id: 'edit-shorter-hooks', label: 'Shorter hooks', kind: 'preference', weight: 0.78 },
          { id: 'edit-no-emoji', label: 'Avoids emoji', kind: 'preference', weight: 0.42 },
          { id: 'topic-ai', label: 'AI / Tech', kind: 'topic', weight: 0.9 },
        ],
        edges: [
          { source: 'creator', target: 'tone-direct', kind: 'expresses' },
          { source: 'creator', target: 'tone-warm', kind: 'expresses' },
          { source: 'creator', target: 'platform-twitter', kind: 'posts_on' },
          { source: 'creator', target: 'platform-shorts', kind: 'posts_on' },
          { source: 'platform-twitter', target: 'edit-shorter-hooks', kind: 'shaped_by' },
          { source: 'platform-twitter', target: 'edit-no-emoji', kind: 'shaped_by' },
          { source: 'creator', target: 'topic-ai', kind: 'focuses_on' },
          { source: 'tone-direct', target: 'edit-shorter-hooks', kind: 'reinforces' },
        ],
        stats: { memories: 7, biases: 8, edits: 12 },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Radial layout: root at center, other nodes evenly distributed.
  const positioned = useMemo(() => {
    if (!graph) return { nodes: {} as Record<string, { x: number; y: number; node: GraphNode }>, width: 720, height: 420, cx: 360, cy: 210 }
    const width = 720
    const height = 420
    const cx = width / 2
    const cy = height / 2
    const others = filteredNodes.filter((n) => n.kind !== 'root')
    const radius = 150
    const placed: Record<string, { x: number; y: number; node: GraphNode }> = {}
    filteredNodes
      .filter((n) => n.kind === 'root')
      .forEach((n) => {
        placed[n.id] = { x: cx, y: cy, node: n }
      })
    others.forEach((n, i) => {
      const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2
      placed[n.id] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        node: n,
      }
    })
    return { nodes: placed, width, height, cx, cy }
  }, [graph, filteredNodes])

  const header = platform ? PLATFORM_HEADERS[platform] ?? DEFAULT_HEADER : DEFAULT_HEADER

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-[#FAF7F0] shadow-[4px_4px_0_#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#9575CD] shadow-[2px_2px_0_#1a1a1a]">
            <Brain className="h-5 w-5 text-[#FAF7F0]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a1a1a]/50">
              Intelligence Graph
            </p>
            <p className="text-sm font-black text-[#1a1a1a]">{header.title}</p>
            <p className="text-xs font-medium text-[#1a1a1a]/60">{header.sub}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border-2 border-[#1a1a1a] bg-[#FAF7F0] p-0.5">
            {([
              { id: 'graph',    Icon: Share2,      title: 'Graph view'    },
              { id: 'table',    Icon: LayoutGrid,  title: 'Table view'    },
              { id: 'timeline', Icon: Clock,       title: 'Timeline view' },
            ] as { id: ViewMode; Icon: React.ComponentType<{className?: string}>; title: string }[]).map(({ id, Icon, title }) => (
              <button
                key={id}
                title={title}
                onClick={() => setView(id)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                  view === id
                    ? 'bg-[#1a1a1a] text-white shadow-[1px_1px_0_#1a1a1a]'
                    : 'text-[#1a1a1a]/50 hover:bg-white hover:text-[#1a1a1a]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <button
            onClick={load}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#1a1a1a] bg-white transition-all hover:bg-[#FFD180] hover:shadow-[2px_2px_0_#1a1a1a]"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-[#1a1a1a]', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {graph && (
        <div className="grid grid-cols-3 border-b-2 border-[#1a1a1a]">
          <Stat icon={Sparkles} label="Memories" value={graph.stats.memories} bg="#FFD180" />
          <Stat icon={GitBranch} label="Biases" value={graph.stats.biases} bg="#FFB199" />
          <Stat icon={Pencil} label="Edits learned" value={graph.stats.edits} bg="#A5D6A7" />
        </div>
      )}

      {/* Tag filter chips */}
      {graph && (
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#1a1a1a] bg-white px-5 py-2.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#1a1a1a]/40">Filter</span>
          {(Object.entries(KIND_COLORS) as [GraphNodeKind, typeof KIND_COLORS.root][])
            .filter(([kind]) => kind !== 'root')
            .map(([kind, c]) => {
              const active = activeKinds.has(kind)
              const count = graph.nodes.filter(n => n.kind === kind).length
              return (
                <button
                  key={kind}
                  onClick={() => toggleKind(kind)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-[10px] font-bold transition-all',
                    active
                      ? 'border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]'
                      : 'border-[#1a1a1a]/20 opacity-60 hover:opacity-100 hover:border-[#1a1a1a]/60',
                  )}
                  style={{ background: active ? c.fill : '#fff', color: c.text || '#1a1a1a' }}
                >
                  <span className="uppercase tracking-wide">{kind}</span>
                  <span className="rounded-full bg-[#1a1a1a]/15 px-1 text-[9px]">{count}</span>
                </button>
              )
            })}
          {activeKinds.size > 0 && (
            <button
              onClick={() => setActiveKinds(new Set())}
              className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#1a1a1a]/40 hover:text-[#1a1a1a]/70"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Main content — switches by view ── */}
      <div className="bg-[#FAF7F0]">
        {/* GRAPH VIEW */}
        {view === 'graph' && (
          <div className="p-4">
            {graph ? (
              <svg viewBox={`0 0 ${positioned.width} ${positioned.height}`} className="h-auto w-full">
                {/* Edges */}
                {filteredEdges.map((e, i) => {
                  const a = positioned.nodes[e.source]
                  const b = positioned.nodes[e.target]
                  if (!a || !b) return null
                  const isActive = hovered === e.source || hovered === e.target
                  return (
                    <motion.line
                      key={`${e.source}-${e.target}-${i}`}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: isActive ? 1 : 0.35 }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="#1a1a1a"
                      strokeWidth={isActive ? 2.5 : 1.5}
                      strokeDasharray={isActive ? '0' : '4 4'}
                    />
                  )
                })}
                {/* Nodes */}
                {Object.entries(positioned.nodes).map(([id, { x, y, node }], i) => {
                  const colors = KIND_COLORS[node.kind]
                  const radius = node.kind === 'root' ? 38 : 28 + node.weight * 10
                  const isHovered = hovered === id
                  return (
                    <motion.g
                      key={id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 + i * 0.04 }}
                      onMouseEnter={() => setHovered(id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle cx={x + 3} cy={y + 3} r={radius} fill="#1a1a1a" />
                      <circle
                        cx={x} cy={y} r={radius}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={2.5}
                        style={{ filter: isHovered ? 'brightness(1.05)' : 'none', transition: 'filter 0.15s' }}
                      />
                      <text
                        x={x} y={y}
                        textAnchor="middle" dominantBaseline="central"
                        fill={colors.text}
                        fontSize={node.kind === 'root' ? 11 : 10}
                        fontWeight={800}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {truncateLabel(node.label, node.kind === 'root' ? 12 : 14)}
                      </text>
                    </motion.g>
                  )
                })}
              </svg>
            ) : (
              <div className="flex h-64 items-center justify-center text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/40">
                Loading graph…
              </div>
            )}
          </div>
        )}

        {/* TABLE VIEW */}
        {view === 'table' && graph && (
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border-2 border-[#1a1a1a]">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_80px] border-b-2 border-[#1a1a1a] bg-white px-4 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">Memory / Node</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">Kind</span>
                <span className="text-right text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">Confidence</span>
              </div>
              {/* Rows */}
              {[...filteredNodes]
                .filter(n => n.kind !== 'root')
                .sort((a, b) => b.weight - a.weight)
                .map((node, i) => {
                  const c = KIND_COLORS[node.kind]
                  const pct = Math.round(node.weight * 100)
                  return (
                    <div
                      key={node.id}
                      className={cn(
                        'grid grid-cols-[1fr_100px_80px] items-center border-b border-[#1a1a1a]/10 px-4 py-3 last:border-b-0',
                        i % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F0]',
                      )}
                    >
                      <span className="text-sm font-semibold text-[#1a1a1a]">{node.label}</span>
                      <span
                        className="inline-flex w-fit items-center rounded-full border border-[#1a1a1a]/20 px-2 py-0.5 text-[10px] font-bold capitalize"
                        style={{ background: c.fill, color: c.text || '#1a1a1a' }}
                      >
                        {node.kind}
                      </span>
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#1a1a1a]/10">
                          <div
                            className="h-full rounded-full bg-[#9575CD]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-7 text-right text-[10px] font-bold text-[#1a1a1a]/60">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* TIMELINE VIEW */}
        {view === 'timeline' && graph && (
          <div className="px-5 py-5">
            <div className="relative">
              {/* Vertical rail */}
              <div className="absolute left-[18px] top-0 h-full w-0.5 bg-[#1a1a1a]/15" />
              <div className="space-y-3">
                {[...filteredNodes]
                  .filter(n => n.kind !== 'root')
                  .sort((a, b) => b.weight - a.weight)
                  .map((node, i) => {
                    const c = KIND_COLORS[node.kind]
                    const pct = Math.round(node.weight * 100)
                    return (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.25 }}
                        className="flex items-start gap-4"
                      >
                        {/* Dot */}
                        <div
                          className="relative z-10 mt-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]"
                          style={{ background: c.fill }}
                        >
                          <span className="text-[9px] font-black text-[#1a1a1a]">{i + 1}</span>
                        </div>
                        {/* Card */}
                        <div className="flex-1 rounded-xl border-2 border-[#1a1a1a] bg-white px-4 py-3 shadow-[2px_2px_0_#1a1a1a]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-bold text-[#1a1a1a]">{node.label}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="rounded-full border border-[#1a1a1a]/20 px-2 py-0.5 text-[9px] font-bold capitalize"
                                style={{ background: c.fill, color: c.text || '#1a1a1a' }}
                              >
                                {node.kind}
                              </span>
                              <span className="text-[10px] font-black text-[#1a1a1a]/50">{pct}%</span>
                            </div>
                          </div>
                          {node.full_text && (
                            <p className="mt-1 text-xs leading-relaxed text-[#1a1a1a]/60 line-clamp-2">
                              {node.full_text}
                            </p>
                          )}
                          {/* Confidence bar */}
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1a1a1a]/8">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.06 + 0.2, duration: 0.4 }}
                              className="h-full rounded-full"
                              style={{ background: c.fill }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend — only shown in graph view */}
      {view === 'graph' && (
        <div className="flex flex-wrap items-center gap-3 border-t-2 border-[#1a1a1a] bg-white px-5 py-3">
          {(Object.entries(KIND_COLORS) as [GraphNodeKind, typeof KIND_COLORS.root][]).map(
            ([kind, c]) => (
              <div key={kind} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-full border-2 border-[#1a1a1a]"
                  style={{ background: c.fill }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/70">
                  {kind}
                </span>
              </div>
            ),
          )}
          <span className="ms-auto text-[10px] font-medium text-[#1a1a1a]/40">
            Hover a node to trace its influence
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  bg: string
}) {
  return (
    <div
      className="flex items-center gap-2 border-r-2 border-[#1a1a1a] px-4 py-2 last:border-r-0"
      style={{ background: bg }}
    >
      <Icon className="h-3.5 w-3.5 text-[#1a1a1a]" />
      <span className="text-lg font-black text-[#1a1a1a]">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/65">
        {label}
      </span>
    </div>
  )
}

/** Truncate an SVG text label so it fits inside the node circle. */
function truncateLabel(label: string, max: number): string {
  if (label.length <= max) return label
  return label.slice(0, max - 1).trimEnd() + '…'
}

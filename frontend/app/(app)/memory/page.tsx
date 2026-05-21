'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, RefreshCw, Sparkles, GitBranch, Pencil, Clock, AlertCircle, Share2, LayoutGrid, AlignLeft } from 'lucide-react'
import { MemoryGraphCanvas } from '@/components/memory-graph-canvas'
import { api, isCacheWarm } from '@/lib/api'
import type { IntelligenceGraph, GraphNodeKind } from '@/lib/types'
import { cn } from '@/lib/utils'

type ViewMode = 'graph' | 'table' | 'timeline'

const KIND_COLORS: Record<string, { fill: string; text: string }> = {
  trait:      { fill: '#FFD180', text: '#1a1a1a' },
  platform:   { fill: '#9575CD', text: '#FAF7F0' },
  preference: { fill: '#FF8A65', text: '#1a1a1a' },
  topic:      { fill: '#A5D6A7', text: '#1a1a1a' },
}

export default function MemoryPage() {
  const [graph, setGraph]               = useState<IntelligenceGraph | null>(null)
  const [loading, setLoading]           = useState(() => !isCacheWarm('intelligence/graph', 60_000))
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [error, setError]               = useState(false)
  const [view, setView]                 = useState<ViewMode>('graph')
  const [activeKinds, setActiveKinds]   = useState<Set<string>>(new Set())

  function toggleKind(kind: string) {
    setActiveKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  // Filtered nodes (always include root so graph stays anchored)
  const filteredNodes = useMemo(() => {
    if (!graph) return []
    if (activeKinds.size === 0) return graph.nodes
    return graph.nodes.filter(n => n.kind === 'root' || activeKinds.has(n.kind))
  }, [graph, activeKinds])

  const filteredIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])

  const filteredGraph = useMemo(() => {
    if (!graph) return null
    return {
      ...graph,
      nodes: filteredNodes,
      edges: graph.edges.filter(e => filteredIds.has(e.source) && filteredIds.has(e.target)),
    }
  }, [graph, filteredNodes, filteredIds])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const g = await api.intelligence.graph('global')
      setGraph(g)
      setLastRefreshed(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-7">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#9575CD] shadow-[3px_3px_0_#1a1a1a]">
            <Brain className="h-5 w-5 text-[#FAF7F0]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1a1a1a]">Memory Bank</h1>
            <p className="text-xs font-semibold text-[#1a1a1a]/45">
              What OrbitOS has learned about your creator persona
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#1a1a1a]/40">
              <Clock className="h-3 w-3" />
              {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 rounded-xl border-2 border-[#1a1a1a] bg-white px-3 py-2 text-xs font-bold shadow-[3px_3px_0_#1a1a1a] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1a1a1a] disabled:opacity-50">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      {graph && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-4">
          {[
            { icon: Sparkles,  label: 'Total Memories',    value: graph.stats.memories, bg: '#FFD180' },
            { icon: GitBranch, label: 'Learned Biases',    value: graph.stats.biases,   bg: '#FFB199' },
            { icon: Pencil,    label: 'Edit Observations', value: graph.stats.edits,    bg: '#A5D6A7' },
          ].map(({ icon: Icon, label, value, bg }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border-2 border-[#1a1a1a] bg-white p-4 shadow-[4px_4px_0_#1a1a1a]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a]"
                style={{ background: bg }}>
                <Icon className="h-4 w-4 text-[#1a1a1a]" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#1a1a1a]">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/50">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-2xl border-2 border-[#FF8A65] bg-[#FFF3EE] px-5 py-4">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#FF8A65]" />
            <p className="text-sm font-semibold text-[#1a1a1a]/70">
              Memory bank offline — Hindsight is not reachable. Process a video and complete a review to start building memory.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && !graph && (
        <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-[#1a1a1a]/20 bg-white">
          <div className="flex flex-col items-center gap-3">
            <Brain className="h-8 w-8 animate-pulse text-[#9575CD]" />
            <p className="text-xs font-bold text-[#1a1a1a]/40">Querying Hindsight memory bank…</p>
          </div>
        </div>
      )}

      {/* View toggle + tag filter */}
      {graph && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#1a1a1a] bg-white px-5 py-3 shadow-[3px_3px_0_#1a1a1a]">

          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border-2 border-[#1a1a1a] bg-[#FAF7F0] p-0.5">
            {([
              { id: 'graph',    Icon: Share2,     label: 'Graph'    },
              { id: 'table',    Icon: LayoutGrid, label: 'Table'    },
              { id: 'timeline', Icon: AlignLeft,  label: 'Timeline' },
            ] as { id: ViewMode; Icon: React.ComponentType<{className?: string}>; label: string }[]).map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setView(id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-all',
                  view === id
                    ? 'bg-[#1a1a1a] text-white shadow-[1px_1px_0_#1a1a1a]'
                    : 'text-[#1a1a1a]/50 hover:bg-white hover:text-[#1a1a1a]',
                )}>
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Tag filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#1a1a1a]/40">Filter</span>
            {Object.entries(KIND_COLORS).map(([kind, c]) => {
              const active = activeKinds.has(kind)
              const count = graph.nodes.filter(n => n.kind === kind).length
              return (
                <button key={kind} onClick={() => toggleKind(kind as GraphNodeKind)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-[10px] font-bold transition-all',
                    active
                      ? 'border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]'
                      : 'border-[#1a1a1a]/20 opacity-60 hover:opacity-100 hover:border-[#1a1a1a]/50',
                  )}
                  style={{ background: active ? c.fill : '#fff', color: active ? c.text : '#1a1a1a' }}>
                  <span className="capitalize">{kind}</span>
                  <span className="rounded-full bg-[#1a1a1a]/15 px-1 text-[9px]">{count}</span>
                </button>
              )
            })}
          </div>

          {activeKinds.size > 0 && (
            <button onClick={() => setActiveKinds(new Set())}
              className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#1a1a1a]/40 hover:text-[#1a1a1a]/70">
              Clear
            </button>
          )}
        </motion.div>
      )}

      {/* Force-directed graph */}
      {view === 'graph' && filteredGraph && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          <MemoryGraphCanvas graph={filteredGraph} />
        </motion.div>
      )}

      {/* Table view */}
      {view === 'table' && filteredGraph && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-2xl border-2 border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]">
          <div className="grid grid-cols-[1fr_110px_120px_90px] border-b-2 border-[#1a1a1a] bg-white px-5 py-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">Memory</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">Kind</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">Hindsight Tags</span>
            <span className="text-right text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/50">Match</span>
          </div>
          {[...filteredGraph.nodes]
            .filter(n => n.kind !== 'root')
            .sort((a, b) => b.weight - a.weight)
            .map((node, i) => {
              const c = KIND_COLORS[node.kind] ?? { fill: '#F5F5F5', text: '#1a1a1a' }
              const pct = Math.round(node.weight * 100)
              return (
                <div key={node.id}
                  className={cn(
                    'grid grid-cols-[1fr_110px_120px_90px] items-center border-b border-[#1a1a1a]/10 px-5 py-3 last:border-b-0',
                    i % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F0]',
                  )}>
                  <span className="truncate pr-3 text-sm font-semibold text-[#1a1a1a]">{node.label}</span>
                  <span className="inline-flex w-fit items-center rounded-full border border-[#1a1a1a]/20 px-2.5 py-0.5 text-[10px] font-bold capitalize"
                    style={{ background: c.fill, color: c.text }}>
                    {node.kind}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(node.tags ?? []).slice(0, 2).map(tag => (
                      <span key={tag}
                        className="rounded-full border border-[#1a1a1a]/12 bg-[#FAF7F0] px-1.5 py-0.5 text-[9px] font-medium text-[#1a1a1a]/55">
                        #{tag}
                      </span>
                    ))}
                    {!node.tags?.length && (
                      <span className="text-[9px] text-[#1a1a1a]/25">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#1a1a1a]/10">
                      <div className="h-full rounded-full bg-[#9575CD]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-7 text-right text-[10px] font-bold text-[#1a1a1a]/60">{pct}%</span>
                  </div>
                </div>
              )
            })}
        </motion.div>
      )}

      {/* Timeline view */}
      {view === 'timeline' && filteredGraph && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-1 py-2">
          <div className="relative">
            <div className="absolute left-[18px] top-0 h-full w-0.5 bg-[#1a1a1a]/15" />
            <div className="space-y-3">
              {[...filteredGraph.nodes]
                .filter(n => n.kind !== 'root')
                // Sort by real Hindsight timestamp when available, otherwise by weight
                .sort((a, b) => {
                  if (a.mentioned_at && b.mentioned_at)
                    return new Date(b.mentioned_at).getTime() - new Date(a.mentioned_at).getTime()
                  return b.weight - a.weight
                })
                .map((node, i) => {
                  const c = KIND_COLORS[node.kind] ?? { fill: '#F5F5F5', text: '#1a1a1a' }
                  const pct = Math.round(node.weight * 100)
                  const ts = node.mentioned_at
                    ? new Date(node.mentioned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
                    : null
                  return (
                    <motion.div key={node.id}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                      className="flex items-start gap-4">
                      {/* Dot */}
                      <div className="relative z-10 mt-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]"
                        style={{ background: c.fill }}>
                        <span className="text-[9px] font-black" style={{ color: c.text }}>{i + 1}</span>
                      </div>
                      {/* Card */}
                      <div className="flex-1 rounded-2xl border-2 border-[#1a1a1a] bg-white px-5 py-3.5 shadow-[3px_3px_0_#1a1a1a]">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-[#1a1a1a]">{node.full_text || node.label}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-full border border-[#1a1a1a]/20 px-2 py-0.5 text-[9px] font-bold capitalize"
                              style={{ background: c.fill, color: c.text }}>
                              {node.kind}
                            </span>
                            <span className="text-[10px] font-black text-[#1a1a1a]/50">{pct}%</span>
                          </div>
                        </div>

                        {/* Real Hindsight tags */}
                        {node.tags && node.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {node.tags.map(tag => (
                              <span key={tag}
                                className="rounded-full border border-[#1a1a1a]/15 bg-[#FAF7F0] px-2 py-0.5 text-[9px] font-semibold text-[#1a1a1a]/60">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          {/* Confidence bar */}
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]/8">
                            <motion.div className="h-full rounded-full"
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                              style={{ background: c.fill }} />
                          </div>
                          {/* Real Hindsight timestamp */}
                          {ts && (
                            <span className="shrink-0 text-[9px] font-semibold text-[#1a1a1a]/35">{ts}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !error && graph && graph.nodes.length <= 1 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1a1a1a]/20 py-16 text-center">
          <Brain className="mb-4 h-10 w-10 text-[#1a1a1a]/20" />
          <p className="text-sm font-black text-[#1a1a1a]/40">No memories yet</p>
          <p className="mt-1 text-xs font-semibold text-[#1a1a1a]/30">
            Process a video, complete the review, and your voice starts building here.
          </p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'
import type { IntelligenceGraph, GraphNode, GraphEdge } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── constants ────────────────────────────────────────────────────────────
const W = 920
const H = 560

const EDGE_COLOR: Record<string, string> = {
  shapes:   '#94A3B8',
  semantic: '#60A5FA',
  temporal: '#2DD4BF',
  entity:   '#FBBF24',
  causal:   '#C084FC',
}
const EDGE_LABEL: Record<string, string> = {
  shapes:   'Core',
  semantic: 'Semantic',
  temporal: 'Temporal',
  entity:   'Entity',
  causal:   'Causal',
}
const NODE_FILL: Record<string, string> = {
  root:       '#1a1a1a',
  trait:      '#FFD180',
  platform:   '#9575CD',
  preference: '#FF8A65',
  topic:      '#A5D6A7',
}
const NODE_TEXT: Record<string, string> = {
  root:       '#FAF7F0',
  trait:      '#1a1a1a',
  platform:   '#FAF7F0',
  preference: '#1a1a1a',
  topic:      '#1a1a1a',
}
const KIND_LABEL: Record<string, string> = {
  root: 'Core', trait: 'Trait', platform: 'Platform', preference: 'Preference', topic: 'Topic',
}

// ─── force simulation ────────────────────────────────────────────────────
type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number }

function simulate(rawNodes: GraphNode[], edges: GraphEdge[]): SimNode[] {
  const nodes: SimNode[] = rawNodes.map(n => ({
    ...n,
    x: W / 2 + (Math.random() - 0.5) * 700,
    y: H / 2 + (Math.random() - 0.5) * 500,
    vx: 0,
    vy: 0,
  }))
  const map = new Map(nodes.map(n => [n.id, n]))

  // Fix root at centre
  const root = map.get('creator')
  if (root) { root.x = W / 2; root.y = H / 2 }

  const REPULSION = 14000
  const SPRING_K  = 0.025
  const IDEAL_LEN = 220
  const CENTER    = 0.004
  const DAMP      = 0.75
  const ITERS     = 800

  // Only structural edges drive the layout — entity edges (192) collapse everything
  const layoutEdges = edges.filter(e => e.kind !== 'entity')

  for (let t = 0; t < ITERS; t++) {
    const a = 1 - t / ITERS

    // Repulsion (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const na = nodes[i], nb = nodes[j]
        const dx = nb.x - na.x, dy = nb.y - na.y
        const d2 = dx * dx + dy * dy + 1
        const d  = Math.sqrt(d2)
        const f  = (REPULSION / d2) * a
        const fx = (dx / d) * f, fy = (dy / d) * f
        na.vx -= fx; na.vy -= fy
        nb.vx += fx; nb.vy += fy
      }
    }

    // Spring along structural edges only (not entity)
    for (const e of layoutEdges) {
      const na = map.get(e.source), nb = map.get(e.target)
      if (!na || !nb) continue
      const dx = nb.x - na.x, dy = nb.y - na.y
      const d  = Math.sqrt(dx * dx + dy * dy) + 0.1
      const f  = SPRING_K * (d - IDEAL_LEN) * a
      const fx = (dx / d) * f, fy = (dy / d) * f
      na.vx += fx; na.vy += fy
      nb.vx -= fx; nb.vy -= fy
    }

    // Centering
    let cx = 0, cy = 0
    for (const n of nodes) { cx += n.x; cy += n.y }
    cx /= nodes.length; cy /= nodes.length
    for (const n of nodes) {
      n.vx += (W / 2 - cx) * CENTER
      n.vy += (H / 2 - cy) * CENTER
    }

    // Integrate
    for (const n of nodes) {
      n.vx *= DAMP; n.vy *= DAMP
      n.x  += n.vx; n.y  += n.vy
    }
  }
  return nodes
}

// ─── component ────────────────────────────────────────────────────────────
interface Props { graph: IntelligenceGraph }

export function MemoryGraphCanvas({ graph }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const simNodes = useMemo(() => simulate(graph.nodes, graph.edges), [graph])
  const nodeMap  = useMemo(() => new Map(simNodes.map(n => [n.id, n])), [simNodes])

  // View transform
  const [vt, setVt] = useState({ x: 0, y: 0, s: 1 })
  const panRef = useRef<{ active: boolean; sx: number; sy: number; tx: number; ty: number }>({
    active: false, sx: 0, sy: 0, tx: 0, ty: 0,
  })

  const [selected, setSelected] = useState<SimNode | null>(null)
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [hidden,   setHidden]   = useState<Set<string>>(new Set())

  // Edge type counts
  const edgeKinds = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of graph.edges) counts[e.kind] = (counts[e.kind] ?? 0) + 1
    return counts
  }, [graph])

  // Non-passive wheel listener
  const zoom = useCallback((delta: number) => {
    setVt(v => ({ ...v, s: Math.max(0.25, Math.min(3.5, v.s * (1 + delta))) }))
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      zoom(e.deltaY < 0 ? 0.1 : -0.1)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [zoom])

  // Pan
  const onPtrDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('.mgc-node')) return
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, tx: vt.x, ty: vt.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPtrMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!panRef.current.active) return
    setVt(v => ({
      ...v,
      x: panRef.current.tx + e.clientX - panRef.current.sx,
      y: panRef.current.ty + e.clientY - panRef.current.sy,
    }))
  }
  const onPtrUp = () => { panRef.current.active = false }

  const resetView = () => setVt({ x: 0, y: 0, s: 1 })

  const toggleKind = (kind: string) =>
    setHidden(prev => { const n = new Set(prev); n.has(kind) ? n.delete(kind) : n.add(kind); return n })

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-[#FAF7F0] shadow-[4px_4px_0_#1a1a1a]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-white px-5 py-3">
        <div>
          <p className="text-sm font-black text-[#1a1a1a]">Memory Graph</p>
          <p className="text-[10px] font-semibold text-[#1a1a1a]/50">
            {graph.nodes.length} nodes · {graph.edges.length} links · scroll to zoom · drag to pan
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => zoom(0.18)} title="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#1a1a1a] bg-white hover:bg-[#FFD180] transition-colors">
            <ZoomIn className="h-3.5 w-3.5 text-[#1a1a1a]" />
          </button>
          <button onClick={() => zoom(-0.18)} title="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#1a1a1a] bg-white hover:bg-[#FFD180] transition-colors">
            <ZoomOut className="h-3.5 w-3.5 text-[#1a1a1a]" />
          </button>
          <button onClick={resetView} title="Reset view"
            className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#1a1a1a] bg-white hover:bg-[#FFD180] transition-colors">
            <Maximize2 className="h-3.5 w-3.5 text-[#1a1a1a]" />
          </button>
        </div>
      </div>

      {/* ── Canvas + side panel ── */}
      <div className="flex">

        {/* Graph SVG */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="flex-1 cursor-grab active:cursor-grabbing select-none"
          style={{ height: 540, overflow: 'hidden' }}
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrUp}
          onClick={() => setSelected(null)}
        >
          {/* Dot-grid background */}
          <defs>
            <pattern id="mgc-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#1a1a1a" opacity="0.07" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#mgc-grid)" />

          <g transform={`translate(${vt.x},${vt.y}) scale(${vt.s})`}>

            {/* Edges */}
            {graph.edges.map((edge, i) => {
              if (hidden.has(edge.kind)) return null
              const a = nodeMap.get(edge.source)
              const b = nodeMap.get(edge.target)
              if (!a || !b) return null
              const active = hovered === edge.source || hovered === edge.target
                          || selected?.id === edge.source || selected?.id === edge.target
              return (
                <line
                  key={`e${i}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={EDGE_COLOR[edge.kind] ?? '#94A3B8'}
                  strokeWidth={active ? 2.5 : 1}
                  opacity={active ? 0.92 : 0.28}
                  style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }}
                />
              )
            })}

            {/* Nodes */}
            {simNodes.map(node => {
              const fill   = NODE_FILL[node.kind]  ?? '#CBD5E1'
              const tcolor = NODE_TEXT[node.kind]  ?? '#1a1a1a'
              const r      = node.kind === 'root' ? 30 : Math.min(22, 13 + node.weight * 9)
              const isHov  = hovered === node.id
              const isSel  = selected?.id === node.id
              // Truncate label to fit inside circle (fewer words for smaller nodes)
              const maxWords = r > 20 ? 3 : r > 16 ? 2 : 1
              const words  = node.label.split(' ').slice(0, maxWords).join(' ')
              const labelOutside = r < 18  // draw text below the circle for small nodes
              const scale  = isHov || isSel ? 1.25 : 1

              return (
                <g
                  key={node.id}
                  className="mgc-node"
                  style={{ cursor: 'pointer', transform: `scale(${scale})`, transformOrigin: `${node.x}px ${node.y}px`, transition: 'transform 0.12s ease' }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={e => { e.stopPropagation(); setSelected(isSel ? null : node) }}
                >
                  {/* drop shadow */}
                  <circle cx={node.x + 2} cy={node.y + 2} r={r} fill="#1a1a1a" opacity={0.15} />
                  {/* body */}
                  <circle
                    cx={node.x} cy={node.y}
                    r={r}
                    fill={fill}
                    stroke={isSel ? '#FF8A65' : '#1a1a1a'}
                    strokeWidth={isSel ? 3.5 : 2}
                  />
                  {/* label — inside for large nodes, below for small ones */}
                  {labelOutside ? (
                    <text
                      x={node.x} y={node.y + r + 11}
                      textAnchor="middle" dominantBaseline="central"
                      fill="#1a1a1a"
                      fontSize={8}
                      fontWeight={700}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {words}
                    </text>
                  ) : (
                    <text
                      x={node.x} y={node.y}
                      textAnchor="middle" dominantBaseline="central"
                      fill={tcolor}
                      fontSize={node.kind === 'root' ? 10 : 9}
                      fontWeight={800}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {words}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* ── Side panel ── */}
        <div className="flex w-52 shrink-0 flex-col gap-5 border-l-2 border-[#1a1a1a] bg-white p-4">

          {/* Counts */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">Graph</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between font-semibold text-[#1a1a1a]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#1a1a1a] inline-block" />
                  Nodes
                </span>
                <span className="font-black">{graph.nodes.length}/{graph.nodes.length}</span>
              </div>
              <div className="flex justify-between text-[#1a1a1a]/50 font-semibold">
                <span>Links ({graph.edges.length})</span>
                <span className="text-[10px]">click to filter</span>
              </div>
            </div>
          </div>

          {/* Edge type filter */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">Link Types</p>
            <div className="space-y-1">
              {Object.entries(edgeKinds).map(([kind, count]) => (
                <button
                  key={kind}
                  onClick={() => toggleKind(kind)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-all hover:bg-[#FAF7F0]',
                    hidden.has(kind) && 'opacity-35 line-through',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-5 rounded-full shrink-0"
                      style={{ background: EDGE_COLOR[kind] ?? '#94A3B8' }} />
                    <span className="font-semibold text-[#1a1a1a]">{EDGE_LABEL[kind] ?? kind}</span>
                  </span>
                  <span className="font-black text-[#1a1a1a]/50">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Node kind legend */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">Node Types</p>
            <div className="space-y-1">
              {Object.entries(NODE_FILL).map(([kind, fill]) => (
                <div key={kind} className="flex items-center gap-2 text-xs">
                  <span className="h-3 w-3 shrink-0 rounded-full border-2 border-[#1a1a1a]"
                    style={{ background: fill }} />
                  <span className="font-semibold text-[#1a1a1a]">{KIND_LABEL[kind]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected node detail */}
          {selected ? (
            <div className="flex-1 overflow-y-auto rounded-xl border-2 border-[#1a1a1a] bg-[#FAF7F0] p-3">
              <div className="mb-3 flex items-start justify-between gap-1">
                <span
                  className="rounded-full border border-[#1a1a1a] px-2 py-0.5 text-[10px] font-bold leading-none"
                  style={{ background: NODE_FILL[selected.kind], color: NODE_TEXT[selected.kind] }}
                >
                  {KIND_LABEL[selected.kind] ?? selected.kind}
                </span>
                <button onClick={() => setSelected(null)}
                  className="text-[#1a1a1a]/40 hover:text-[#1a1a1a] transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs font-bold leading-relaxed text-[#1a1a1a]">
                {selected.label}
              </p>
              {selected.full_text && selected.full_text !== selected.label && (
                <p className="mt-2 text-[10px] leading-relaxed text-[#1a1a1a]/60 border-t border-[#1a1a1a]/10 pt-2">
                  {selected.full_text}
                </p>
              )}
              <div className="mt-3 flex items-center gap-1.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]/10">
                  <div className="h-full rounded-full bg-[#9575CD]"
                    style={{ width: `${Math.round(selected.weight * 100)}%` }} />
                </div>
                <span className="text-[10px] font-black text-[#1a1a1a]/50 shrink-0">
                  {Math.round(selected.weight * 100)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-[#1a1a1a]/15 p-3">
              <p className="text-center text-[10px] font-semibold leading-relaxed text-[#1a1a1a]/35">
                Click any node to inspect its memory
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

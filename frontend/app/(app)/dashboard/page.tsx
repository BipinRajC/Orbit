'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UploadInput } from '@/components/upload-input'
import { ProjectCard } from '@/components/project-card'
import { Mascot, ThoughtBubble } from '@/components/mascot'
import { api } from '@/lib/api'
import type { ProjectListItem } from '@/lib/types'
import {
  Video,
  Sparkles,
  Brain,
  Mic,
  MessageCircle,
  Wand2,
  TrendingUp,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const CTA_LINES = [
  { heading: 'Drop a YouTube link',          sub: '~3 min · get hooks, briefs & clip notes — ready to post' },
  { heading: 'Turn 1 video into 7 posts',    sub: 'AI extracts your strongest moments automatically' },
  { heading: 'Extract your best moments',    sub: 'Claude ranks every segment by virality score' },
  { heading: 'Write platform-ready briefs',  sub: 'Instagram Reels · YouTube Shorts · LinkedIn — all at once' },
  { heading: 'Build a week of content',      sub: 'Approve, regen, or copy each brief in one click' },
]

const FEATURE_PILLS = [
  { icon: Brain,         label: 'Moment Detection' },
  { icon: Wand2,         label: 'Hook Writer' },
  { icon: MessageCircle, label: 'Tweet Threads' },
  { icon: Mic,           label: 'Voice Clone' },
  { icon: TrendingUp,    label: 'Virality Scoring' },
]

const FEATURE_CARDS = [
  { icon: Brain,         bg: '#FFE0B2', title: 'Moment Detection', desc: 'AI finds the clips people actually want to share, ranked by virality.', stat: '3–8 per video' },
  { icon: Wand2,         bg: '#FFCDD2', title: 'Hook Generator',   desc: '5 platform-native opening hooks per moment, written to stop the scroll.', stat: '5× faster' },
  { icon: MessageCircle, bg: '#C8E6C9', title: 'Tweet Threads',    desc: 'Moments become tweetable threads instantly. Edit, approve, copy.',          stat: 'Seconds' },
  { icon: Mic,           bg: '#D1C4E9', title: 'Creator Voice',    desc: 'Cascade AI learns your tone from every edit. Output gets more "you".',     stat: 'Adaptive' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [ctaIndex, setCtaIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setCtaIndex(i => (i + 1) % CTA_LINES.length)
    }, 3200)
    return () => clearInterval(t)
  }, [])

  async function fetchProjects() {
    try {
      const data = await api.projects.list()
      setProjects(data)
    } catch {
      // API not available in dev
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  function handleProjectCreated(id: string) {
    router.push(`/projects/${id}`)
  }

  return (
    <div className="relative">
      {/* ── HERO ── */}
      <section className="pb-10 pt-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 flex items-center gap-3"
        >
          <div className="relative">
            <Mascot className="h-14 w-14" />
            <ThoughtBubble className="absolute -right-3 -top-7 h-9 w-12" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1a1a1a]/40">Welcome back</p>
            <p className="text-sm font-bold text-[#1a1a1a]/70">What are we shipping today?</p>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl lg:text-[52px]"
        >
          Turn videos into<br />a week of content.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-4 max-w-2xl text-base leading-relaxed text-[#1a1a1a]/65"
        >
          ContentOS extracts the highest-value moments from any YouTube video, writes
          hooks and tweet threads, and learns your voice — so you ship faster.
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex flex-wrap gap-2"
        >
          {FEATURE_PILLS.map((p, i) => (
            <motion.span
              key={p.label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22 + i * 0.05 }}
              className="flex items-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-xs font-bold text-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]"
            >
              <p.icon className="h-3.5 w-3.5" />
              {p.label}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* ── UPLOAD CTA — cream card ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18 }}
        className="mb-14 rounded-2xl border-2 border-[#1a1a1a] bg-white p-7 shadow-[6px_6px_0_#FF8A65]"
      >
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#FFD180]">
            <Video className="h-6 w-6 text-[#1a1a1a]" />
          </div>
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={ctaIndex}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.32, ease: 'easeInOut' }}
              >
                <h2 className="text-lg font-black text-[#1a1a1a]">{CTA_LINES[ctaIndex].heading}</h2>
                <p className="text-sm font-medium text-[#1a1a1a]/55">{CTA_LINES[ctaIndex].sub}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <UploadInput onProjectCreated={handleProjectCreated} />
      </motion.div>

      {/* ── FEATURE CARDS ── */}
      <section className="mb-14">
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1a1a1a]/40"
        >
          What ContentOS does for you
        </motion.p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {FEATURE_CARDS.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="rounded-2xl border-2 border-[#1a1a1a]/10 bg-white p-5 transition-all hover:-translate-y-1 hover:border-[#1a1a1a] hover:shadow-[4px_4px_0_#1a1a1a]"
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a]"
                style={{ background: f.bg }}
              >
                <f.icon className="h-5 w-5 text-[#1a1a1a]" />
              </div>
              <h3 className="text-sm font-black text-[#1a1a1a]">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#1a1a1a]/55">{f.desc}</p>
              <p className="mt-3 text-[11px] font-bold text-[#1a1a1a]/70">{f.stat}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── STATS ROW ── */}
      {!loading && projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid grid-cols-3 gap-4"
        >
          {[
            { label: 'Total',      value: projects.length,                                                  color: '#1a1a1a',  bg: '#FFD180' },
            { label: 'Processing', value: projects.filter(p => p.status === 'processing').length,          color: '#A1572A',  bg: '#FFE0B2' },
            { label: 'Ready',      value: projects.filter(p => p.status === 'ready_for_review').length,    color: '#2E6B33',  bg: '#C8E6C9' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-2xl border-2 border-[#1a1a1a] bg-white p-5 shadow-[3px_3px_0_#1a1a1a]"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md border border-[#1a1a1a]" style={{ background: stat.bg }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/50">{stat.label}</span>
              </div>
              <p className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── PROJECTS LIST ── */}
      <section className="pb-16">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-[#1a1a1a]/60" />
            <h2 className="text-sm font-black text-[#1a1a1a]">Your Projects</h2>
            {!loading && projects.length > 0 && (
              <span className="rounded-full border border-[#1a1a1a]/15 bg-white px-2 py-0.5 text-[10px] font-bold text-[#1a1a1a]/60">
                {projects.length}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-[112px] animate-pulse rounded-2xl border-2 border-[#1a1a1a]/10 bg-white/50"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border-2 border-dashed border-[#1a1a1a]/20 bg-white/50 py-16 text-center"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
              <Mascot className="h-14 w-14" />
            </div>
            <p className="text-sm font-black text-[#1a1a1a]">No projects yet</p>
            <p className="mt-1 text-xs font-medium text-[#1a1a1a]/55">
              Paste a YouTube URL above to create your first one
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#1a1a1a]/45">
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> ~3 min to process</span>
              <span className="h-3 w-px bg-[#1a1a1a]/15" />
              <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> 5+ pieces per video</span>
              <span className="h-3 w-px bg-[#1a1a1a]/15" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> One-click approve</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {projects.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <ProjectCard project={p} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Back-to-landing link */}
      <div className="pb-8 text-center">
        <Link
          href="/"
          className="text-xs font-semibold text-[#1a1a1a]/40 hover:text-[#1a1a1a]"
        >
          ← Back to landing
        </Link>
      </div>
    </div>
  )
}

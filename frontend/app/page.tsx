'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mascot, ThoughtBubble } from '@/components/mascot'
import { OnboardingDialog } from '@/components/onboarding-dialog'

// ─── Task pills (hero) ────────────────────────────────────────────────
const TASKS = ['Hook Writing', 'Moment Detection', 'Short-Form Scripts', 'Persona Learning']

// ─── Marquee capability ticker (cream theme) ──────────────────────────
const TICKER = [
  '✦ AI Moment Detection',
  '✧ Viral Hook Writing',
  '◆ Short-Form Scripts',
  '✦ Creator Persona Memory',
  '✧ Virality Scoring',
  '◆ Clip Notes',
  '✦ Auto Captions',
  '✧ Platform-Native Drafts',
  '◆ One-Click Approve',
  '✦ Cascade AI',
]

// ─── Floating sparkles (hero decoration) ──────────────────────────────
const SPARKLES = [
  { top: '22%', left: '20%', size: 12, color: '#FF8A65', delay: 0 },
  { top: '34%', left: '14%', size: 8,  color: '#FFD180', delay: 0.6 },
  { top: '15%', left: '40%', size: 10, color: '#9575CD', delay: 1.2 },
  { top: '28%', right: '22%', size: 14, color: '#FF8A65', delay: 0.3 },
  { top: '40%', right: '15%', size: 9,  color: '#A5D6A7', delay: 0.9 },
  { top: '60%', left: '25%', size: 11, color: '#FFD180', delay: 1.5 },
  { top: '55%', right: '28%', size: 10, color: '#FF6B6B', delay: 0.4 },
  { top: '70%', left: '50%', size: 8,  color: '#9575CD', delay: 1.1 },
] as const

function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill={color} />
    </svg>
  )
}

// ─── Comic-style "things you'd rather do" illustrations ───────────────
type Comic = {
  emoji: string
  label: string
  bg: string
  rotate: number
  top?: string
  left?: string
  right?: string
  bottom?: string
}

const COMICS: Comic[] = [
  { emoji: '🎬', label: '',   bg: '#FFE0B2', rotate: -6, top: '8%',     left: '4%' },
  { emoji: '☕', label: '', bg: '#FFCDD2', rotate:  5, top: '12%',    right: '5%' },
  { emoji: '🚴', label: '',     bg: '#C8E6C9', rotate: -4, bottom: '14%', left: '6%' },
  { emoji: '📖', label: '',  bg: '#D1C4E9', rotate:  6, bottom: '10%', right: '4%' },
]

// ─── Steps (1–4 like Jules) ───────────────────────────────────────────
const STEPS = [
  {
    n: 1,
    title: 'Drop a YouTube URL',
    desc: 'Paste any public video link. OrbitOS downloads, transcribes, and segments the full video automatically — no setup, no edits, no tools to learn.',
    chat: {
      user: 'Process this video and find the best 5 moments for Twitter and shorts.',
      ai: "On it. I'll transcribe, score every scene for virality, and draft posts for the top moments.",
    },
  },
  {
    n: 2,
    title: 'Cascade AI extracts your best moments',
    desc: 'OrbitOS splits your video into 5 time chunks, selects the 7 strongest moments (one per day of the week), and writes full platform deliverables for each — in parallel.',
    chat: {
      user: 'Continue.',
      ai: 'Found 7 high-value moments. Top score: 94/100. Generating shorts now…',
    },
  },
  {
    n: 3,
    title: 'Review the drafts',
    desc: 'OrbitOS presents a diff-style view of every generated draft. Tweak one word or rewrite a whole hook — every edit teaches OrbitOS your persona.',
    chat: {
      user: 'Make hook 3 punchier.',
      ai: 'Done. Rewritten with a sharper opening — 18% shorter.',
    },
  },
  {
    n: 4,
    title: 'Approve and publish',
    desc: 'One click approves the batch. OrbitOS exports platform-native drafts ready to post on X, LinkedIn, and short-video platforms.',
    chat: {
      user: 'Approve all and export.',
      ai: '5 posts approved. Exports ready in your inbox.',
    },
  },
]

// ─── Feature cards (Jules-style 4-up row) ─────────────────────────────
const FEATURES = [
  { title: 'YouTube Integration', desc: 'OrbitOS imports any public video, transcribes it, and segments it for you.' },
  { title: 'Virality Scoring',    desc: 'Every scene is scored 0–100 so the best moments rise to the top automatically.' },
  { title: 'Persona Memory',      desc: 'OrbitOS learns your creator persona from every edit you make. Output gets more "you" over time.' },
  { title: 'Available Anywhere',  desc: 'Use OrbitOS from the web, the CLI, or your own workflows via the API.' },
]

// ─── Plans (3 tiers exactly like Jules) ───────────────────────────────
const PLANS = [
  {
    name: 'OrbitOS',
    tag: 'Get started with real content tasks.',
    bullets: ['5 videos per day', '2 concurrent jobs', 'Powered by Cascade Base'],
    cta: 'Try OrbitOS',
    href: '/dashboard',
    accent: '#FFD180',
    glyph: '◆',
    featured: false,
  },
  {
    name: 'OrbitOS in Pro',
    tag: 'For creators who ship daily and want to stay in the flow.',
    bullets: [
      '50 videos per day, enough to run OrbitOS throughout your creator week',
      '10 concurrent jobs, so you can run multiple threads in parallel',
      'Higher access to the latest models, starting with Cascade Pro',
    ],
    cta: 'Upgrade to Pro',
    href: '/dashboard',
    accent: '#FF8A65',
    glyph: '✧',
    featured: true,
  },
  {
    name: 'OrbitOS in Ultra',
    tag: 'For studios who run content engines at scale.',
    bullets: [
      '300 videos per day to power the most demanding studios',
      '60 concurrent jobs, built for massively parallel workflows',
      'Priority access to the latest models, starting with Cascade Pro',
    ],
    cta: 'Talk to us',
    href: '/dashboard',
    accent: '#9575CD',
    glyph: '✦',
    featured: false,
  },
]

// ─── (CodeLine helper removed — inlined into animated map) ───

// ═══════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const router = useRouter()

  function handleCTA() {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF7F0] font-sans text-[#1a1a1a] antialiased selection:bg-[#FFD180] selection:text-[#1a1a1a]">

      {/* Always opens on landing page — user can skip or fill preferences */}
      <OnboardingDialog
        forceOpen={true}
        onComplete={() => router.push('/dashboard')}
      />

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b-2 border-[#1a1a1a]/10 bg-[#FAF7F0]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Mascot className="h-8 w-8" />
            <span className="text-base font-black tracking-tight">OrbitOS</span>
          </Link>
          <button
            onClick={handleCTA}
            className="rounded-full border-2 border-[#1a1a1a] bg-[#1a1a1a] px-4 py-1.5 text-sm font-bold text-[#FAF7F0] transition-all hover:-translate-y-0.5 hover:bg-[#FF8A65] hover:text-[#1a1a1a]"
          >
            Try OrbitOS
          </button>
        </div>
      </header>

      {/* ─── HERO — cream + floating comic illustrations + mascot ─── */}
      <section className="relative overflow-hidden px-6 pt-10 pb-16 sm:pt-14 sm:pb-24">
        {/* Drifting background gradient orbs */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#FFD180]/40 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -right-32 top-40 h-96 w-96 rounded-full bg-[#FF8A65]/30 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, 25, 0], y: [0, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-1/3 bottom-10 h-72 w-72 rounded-full bg-[#9575CD]/20 blur-3xl"
        />

        {/* Floating sparkles */}
        {SPARKLES.map((s, i) => (
          <motion.div
            key={i}
            aria-hidden
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1.15, 0],
              rotate: [0, 180, 360],
            }}
            transition={{ duration: 3.5, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
            className="pointer-events-none absolute hidden lg:block"
            style={{ top: s.top, left: 'left' in s ? s.left : undefined, right: 'right' in s ? s.right : undefined }}
          >
            <Sparkle size={s.size} color={s.color} />
          </motion.div>
        ))}

        {/* Comic illustrations — appear, then float forever */}
        {COMICS.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.7, rotate: c.rotate - 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: [c.rotate - 2, c.rotate + 2, c.rotate - 2],
              y: [0, -12, 0],
            }}
            transition={{
              opacity: { delay: 0.4 + i * 0.1, duration: 0.5 },
              scale:   { delay: 0.4 + i * 0.1, type: 'spring', stiffness: 90 },
              rotate:  { duration: 5 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 + i * 0.1 },
              y:       { duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: 0.4 + i * 0.1 },
            }}
            whileHover={{ scale: 1.12, rotate: c.rotate + 8, transition: { type: 'spring', stiffness: 300 } }}
            className="absolute hidden lg:flex flex-col items-center cursor-pointer"
            style={{ top: c.top, left: c.left, right: c.right, bottom: c.bottom }}
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-[#1a1a1a] shadow-[6px_6px_0_#1a1a1a]"
              style={{ background: c.bg }}
            >
              <span className="text-4xl">{c.emoji}</span>
            </div>
          </motion.div>
        ))}

        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: [-4, 2, -4] }}
            transition={{
              opacity: { delay: 0.1, duration: 0.4 },
              y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.1 },
            }}
            className="mb-1"
          >
            <ThoughtBubble className="h-10 w-16" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 28, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, y: [0, -6, 0] }}
            transition={{
              opacity: { duration: 0.2 },
              scale:   { type: 'spring', stiffness: 55, damping: 18, duration: 1.8 },
              rotate:  { type: 'spring', stiffness: 55, damping: 20, duration: 1.8 },
              y:       { duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 2.0 },
            }}
            whileHover={{ scale: 1.15, rotate: [-5, 5, -5], transition: { duration: 0.4 } }}
            className="mb-5 cursor-pointer"
            style={{ transformOrigin: 'center center' }}
          >
            <Mascot className="h-16 w-16" />
          </motion.div>

          {/* Word-by-word stagger reveal */}
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
            }}
            className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            {['An', 'AI', 'Content'].map((w, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden:  { opacity: 0, y: 30, rotateX: -90 },
                  visible: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring', stiffness: 100 } },
                }}
                className="mr-3 inline-block"
              >
                {w}
              </motion.span>
            ))}
            <br />
            {['Operating', 'System'].map((w, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden:  { opacity: 0, y: 30, rotateX: -90 },
                  visible: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring', stiffness: 100 } },
                }}
                className="mr-3 inline-block"
              >
                {w}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-7 text-lg font-medium text-[#1a1a1a]/80 sm:text-xl"
          >
            OrbitOS turns your long-form YouTube videos into a week of platform-ready shorts — powered by your persona.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.6 } } }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-bold"
          >
            {TASKS.map((t, i) => (
              <motion.span
                key={t}
                variants={{
                  hidden: { opacity: 0, scale: 0.6, y: 12 },
                  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 220 } },
                }}
                className="flex items-center gap-3"
              >
                <motion.span
                  whileHover={{ scale: 1.08, y: -3, rotate: [-2, 2, 0] }}
                  className="cursor-pointer rounded-full border-2 border-[#1a1a1a] bg-white px-4 py-1.5 shadow-[3px_3px_0_#1a1a1a] transition-all hover:bg-[#FFD180]"
                >
                  {t}
                </motion.span>
                {i < TASKS.length - 1 && <span className="text-[#1a1a1a]/40">·</span>}
              </motion.span>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="mt-8 max-w-xl text-base text-[#1a1a1a]/60"
          >
            More time for the content you want to make, and everything else.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="relative mt-10"
          >
            {/* pulsing glow ring behind CTA */}
            <motion.span
              aria-hidden
              animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 -z-10 rounded-full bg-[#FF8A65]/40 blur-xl"
            />
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full border-2 border-[#1a1a1a] bg-[#1a1a1a] px-8 py-3.5 text-base font-bold text-[#FAF7F0] shadow-[5px_5px_0_#FF8A65] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#FF8A65]"
                onClick={e => { e.preventDefault(); handleCTA() }}
              >
                Try OrbitOS
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-lg"
                >
                  →
                </motion.span>
              </Link>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-16 text-xs font-semibold text-[#1a1a1a]/40"
          >
            Brought to life with Cascade AI and the Orbit team.
          </motion.p>
        </div>
      </section>

      {/* ─── PUBLISH ANYWHERE — platform logos ─── */}
      <section className="border-y-2 border-[#1a1a1a]/10 bg-white px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <p className="mb-8 text-center text-xs font-bold uppercase tracking-[0.22em] text-[#1a1a1a]/50">
            Publish anywhere your audience lives
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 sm:gap-x-16">
            {/* YouTube */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.0 }}
              className="flex items-center gap-2.5 text-[#1a1a1a]/80 transition-all hover:scale-105 hover:text-[#FF0000]"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <path fill="currentColor" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span className="text-base font-black tracking-tight">YouTube</span>
            </motion.div>

            {/* X (Twitter) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.05 }}
              className="flex items-center gap-2.5 text-[#1a1a1a]/80 transition-all hover:scale-105 hover:text-black"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-base font-black tracking-tight">X</span>
            </motion.div>

            {/* LinkedIn */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2.5 text-[#1a1a1a]/80 transition-all hover:scale-105 hover:text-[#0A66C2]"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="text-base font-black tracking-tight">LinkedIn</span>
            </motion.div>

            {/* Instagram */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2.5 text-[#1a1a1a]/80 transition-all hover:scale-105 hover:text-[#E1306C]"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
              </svg>
              <span className="text-base font-black tracking-tight">Instagram</span>
            </motion.div>

            {/* TikTok */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2.5 text-[#1a1a1a]/80 transition-all hover:scale-105 hover:text-[#000]"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path fill="currentColor" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
              </svg>
              <span className="text-base font-black tracking-tight">TikTok</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── INFINITE MARQUEE TICKER (cream theme) ─── */}
      <div className="relative overflow-hidden border-y-2 border-[#1a1a1a] bg-[#FFD180] py-4">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="flex gap-10 whitespace-nowrap"
        >
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="text-base font-black tracking-tight text-[#1a1a1a]">
              {item}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ─── SOCIAL OUTPUT PREVIEW — tweet + reel ─── */}
      <section className="border-y-2 border-[#1a1a1a]/10 bg-white py-20">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            className="mb-14 text-center"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#1a1a1a]/50">
              What OrbitOS creates for you
            </p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              From one video to a week of posts
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-stretch">
            {/* ── Twitter / X Post Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -4 }}
              className="flex flex-col rounded-2xl border-2 border-[#1a1a1a] bg-white p-5 shadow-[5px_5px_0_#1a1a1a] transition-shadow hover:shadow-[7px_7px_0_#1a1a1a] min-h-0"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FFB199]">
                    <span className="text-lg font-black text-white">A</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-[15px] font-bold text-[#1a1a1a]">Alex Chen</span>
                      <svg viewBox="0 0 22 22" className="h-4 w-4 text-[#1D9BF0]" fill="currentColor">
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                      </svg>
                    </div>
                    <span className="text-[13px] text-[#1a1a1a]/50">@alexchen_dev</span>
                  </div>
                </div>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#1a1a1a]/60"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </div>

              {/* Tweet body — typed in with stagger */}
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false }}
                variants={{ visible: { transition: { staggerChildren: 0.02 } } }}
                className="mt-4 text-[15px] leading-relaxed text-[#1a1a1a]"
              >
                {Array.from('Most creators spend 6 hours repurposing a single YouTube video. I just dropped a URL into OrbitOS and got 7 platform-ready shorts — all in my persona. This is the future of content. 🧵').map((char, i) => (
                  <motion.span
                    key={i}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1 },
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </motion.p>

              {/* Engagement */}
              <div className="mt-4 flex items-center gap-6 border-t border-[#1a1a1a]/10 pt-3 text-[13px] text-[#1a1a1a]/50">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97-4.97 7.5-7.5 7.5-10.5a5.25 5.25 0 0 0-10.5 0v.75a5.25 5.25 0 0 0-10.5-.75c0 3 2.53 5.53 7.5 10.5z" /></svg>
                  <span className="font-semibold">2.8k</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" /></svg>
                  <span className="font-semibold">847</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="font-semibold">42k</span>
                </span>
              </div>

              {/* Timestamp */}
              <p className="mt-2 text-[12px] text-[#1a1a1a]/40">8:42 PM · May 20, 2026</p>

              {/* AI-generated badge 1 */}

              {/* Divider */}
              <div className="my-4 border-t border-[#1a1a1a]/10" />

              {/* Second tweet draft */}
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false }}
                variants={{ visible: { transition: { staggerChildren: 0.015, delayChildren: 0.4 } } }}
                className="text-[15px] leading-relaxed text-[#1a1a1a]"
              >
                {Array.from('Unpopular opinion: repurposing content is the highest ROI activity for any creator.\n\nNot creating more. Not going viral once.\n\nRepurposing. Consistently. With AI. 🔁').map((char, i) => (
                  <motion.span key={i} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
                    {char === '\n' ? <br /> : char}
                  </motion.span>
                ))}
              </motion.p>

              {/* Engagement row 2 */}
              <div className="mt-4 flex items-center gap-6 border-t border-[#1a1a1a]/10 pt-3 text-[13px] text-[#1a1a1a]/50">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97-4.97 7.5-7.5 7.5-10.5a5.25 5.25 0 0 0-10.5 0v.75a5.25 5.25 0 0 0-10.5-.75c0 3 2.53 5.53 7.5 10.5z" /></svg>
                  <span className="font-semibold">1.1k</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" /></svg>
                  <span className="font-semibold">312</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="font-semibold">18k</span>
                </span>
              </div>
              <p className="mt-2 text-[12px] text-[#1a1a1a]/40">9:15 PM · May 20, 2026</p>

              {/* AI-generated badge 2 */}
            </motion.div>

            {/* ── LinkedIn Post Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.15 }}
              whileHover={{ y: -4 }}
              className="flex flex-col rounded-2xl border-2 border-[#1a1a1a] bg-white shadow-[5px_5px_0_#0A66C2] transition-shadow hover:shadow-[7px_7px_0_#0A66C2] overflow-hidden min-h-0"
            >
              {/* Header */}
              <div className="flex items-start gap-3 p-5 pb-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0A66C2] to-[#004182]">
                  <span className="text-lg font-black text-white">A</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold text-[#1a1a1a]">Alex Chen</span>
                    <span className="text-[13px] text-[#1a1a1a]/40">· 1st</span>
                  </div>
                  <p className="text-[12px] leading-snug text-[#1a1a1a]/50">Head of Growth @ OrbitOS | Creator | AI Enthusiast</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#1a1a1a]/40">
                    <span>2h</span>
                    <span>·</span>
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM4.756 4.21a.75.75 0 0 1 .487.263l.004.005 2.602 3.38 2.595-3.378a.752.752 0 0 1 1.31.72L8.752 9.61a.75.75 0 0 1-1.504 0L4.246 5.2a.75.75 0 0 1 .51-1.09z" /><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
                  </p>
                </div>
                <svg className="h-5 w-5 text-[#1a1a1a]/30" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
              </div>

              {/* Post body */}
              <div className="px-5 pt-3 pb-3">
                <motion.p
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: false }}
                  variants={{ visible: { transition: { staggerChildren: 0.015 } } }}
                  className="text-[14px] leading-relaxed text-[#1a1a1a]"
                >
                  {Array.from('23 cheap (under $100) YouTube content growth hacks you MUST try ❤️\n\nI repurposed a single 1hr YouTube video into 7 shorts using OrbitOS.\n\nThe result? 17,695 views in the first 4 hours.').map((char, i) => (
                    <motion.span
                      key={i}
                      variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1 },
                      }}
                    >
                      {char === '\n' ? <br /> : char}
                    </motion.span>
                  ))}
                </motion.p>
                <p className="mt-1 text-[13px] font-medium text-[#0A66C2] cursor-pointer">...see more</p>
              </div>

              {/* Article preview card */}
              <div className="mx-5 mb-3 overflow-hidden rounded-lg border border-[#1a1a1a]/10">
                <div className="h-40 bg-gradient-to-br from-[#FFE0F0] via-[#FFF0E5] to-[#E8F0FF] flex items-center justify-center">
                  <div className="text-center px-6">
                    <p className="text-xl font-black text-[#6B46C1] leading-tight">23 Incredibly cheap<br />(under $100)<br />Growth Hacks you<br />MUST try</p>
                  </div>
                </div>
                <div className="bg-[#F3F2EF] px-3 py-2">
                  <p className="text-[12px] font-semibold text-[#1a1a1a]/70 truncate">23 Incredibly cheap Growth Hacks you MUST try</p>
                  <p className="text-[11px] text-[#1a1a1a]/40">medium.com</p>
                </div>
              </div>

              {/* Reactions */}
              <div className="flex items-center justify-between border-t border-[#1a1a1a]/10 px-5 py-2 text-[12px] text-[#1a1a1a]/50">
                <div className="flex items-center gap-1">
                  <span className="flex -space-x-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#378FE9] text-[8px] text-white ring-1 ring-white">👍</span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E23B53] text-[8px] text-white ring-1 ring-white">❤️</span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#42B72A] text-[8px] text-white ring-1 ring-white">🎉</span>
                  </span>
                  <span className="ml-1 font-medium">1,045</span>
                </div>
                <span>28 Comments</span>
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-around border-t border-[#1a1a1a]/10 px-5 py-2 text-[13px] font-semibold text-[#1a1a1a]/60">
                <span className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a1a1a]">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3.1a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h.904" /></svg>
                  Like
                </span>
                <span className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a1a1a]">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97-4.97 7.5-7.5 7.5-10.5 0-1.657 0-3 1.5-3s3 1.343 3 3c0 3-2.53 5.53-7.5 10.5m-7.5-10.5c0-1.657 0-3-1.5-3S1.5 5.093 1.5 6.75c0 3 2.53 5.53 7.5 10.5" /></svg>
                  Comment
                </span>
                <span className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a1a1a]">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  Share
                </span>
              </div>

              {/* Views */}
              <div className="mt-auto border-t border-[#1a1a1a]/10 px-5 py-2.5">
                <div className="flex items-center gap-2 text-[12px] text-[#1a1a1a]/50">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
                  <span className="font-semibold">17,695 views of your post in the feed</span>
                </div>
              </div>
            </motion.div>

            {/* ── Instagram Reel Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -4 }}
              className="flex flex-col rounded-2xl border-2 border-[#1a1a1a] bg-[#1a1a1a] shadow-[5px_5px_0_#FF8A65] transition-shadow hover:shadow-[7px_7px_0_#FF8A65] overflow-hidden min-h-0"
            >
              {/* Reel "screen" */}
              <div className="relative flex-1 min-h-[400px] w-full overflow-hidden bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045]">
                {/* Animated gradient overlay */}
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"
                />

                {/* Play icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
                  >
                    <svg className="ml-1 h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </motion.div>
                </div>

                {/* Top bar */}
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
                    <span className="text-sm font-bold text-white">Reels</span>
                  </div>
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.04l-.821 1.315z" /></svg>
                </div>

                {/* Bottom overlay — user info + caption */}
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FFB199] ring-2 ring-white" />
                    <span className="text-sm font-bold text-white">alexchen_dev</span>
                    <span className="rounded-md border border-white/40 px-2 py-0.5 text-[10px] font-bold text-white">Follow</span>
                  </div>
                  <motion.p
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false }}
                    variants={{ visible: { transition: { staggerChildren: 0.015 } } }}
                    className="text-[13px] leading-snug text-white/90"
                  >
                    {Array.from('Here\'s the moment that scored 94/100 on virality. OrbitOS found it in a 1hr YouTube video 🎯🔥').map((char, i) => (
                      <motion.span
                        key={i}
                        variants={{
                          hidden: { opacity: 0 },
                          visible: { opacity: 1 },
                        }}
                      >
                        {char}
                      </motion.span>
                    ))}
                  </motion.p>

                  {/* Music bar */}
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                    <span>Original Audio · alexchen_dev</span>
                  </div>
                </div>

                {/* Side action icons */}
                <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5">
                  <div className="flex flex-col items-center gap-1">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, delay: 1.5 }}>
                      <svg className="h-7 w-7 text-[#FF3040]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                    </motion.div>
                    <span className="text-[11px] font-bold text-white">12.4k</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97-4.97 7.5-7.5 7.5-10.5 0-1.657 0-3 1.5-3s3 1.343 3 3c0 3-2.53 5.53-7.5 10.5m-7.5-10.5c0-1.657 0-3-1.5-3S1.5 5.093 1.5 6.75c0 3 2.53 5.53 7.5 10.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                    <span className="text-[11px] font-bold text-white">843</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                    <span className="text-[11px] font-bold text-white">2.1k</span>
                  </div>
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </section>



      {/* ─── FEATURE TILES (4-up) ─── */}
      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group rounded-2xl border-2 border-[#1a1a1a]/10 bg-white p-6 transition-all hover:border-[#1a1a1a] hover:shadow-[6px_6px_0_#1a1a1a]"
            >
              <motion.div
                whileHover={{ rotate: [0, -8, 8, -8, 0], scale: 1.1 }}
                transition={{ duration: 0.5 }}
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#FFD180] text-lg font-black"
              >
                {i + 1}
              </motion.div>
              <h3 className="mb-2 text-base font-black">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[#1a1a1a]/60">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── INTRO LINE before steps ─── */}
      <section className="px-6 pb-8 text-center">
        <p className="mx-auto max-w-2xl text-base text-[#1a1a1a]/60">
          Use OrbitOS from the web, the{' '}
          <a className="underline decoration-[#FF8A65] decoration-2 underline-offset-4 hover:text-[#FF8A65]" href="#">CLI</a>
          {' '}or build your own workflows using the{' '}
          <a className="underline decoration-[#FF8A65] decoration-2 underline-offset-4 hover:text-[#FF8A65]" href="#">API</a>.
        </p>
      </section>

      {/* ─── STEPS 1–4 with chat bubbles ─── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl space-y-24">
          {STEPS.map((s) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="grid items-start gap-10 lg:grid-cols-[100px_1fr_360px]"
            >
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: false }}
                transition={{ type: 'spring', stiffness: 140, delay: 0.1 }}
                className="text-[80px] font-black leading-none text-[#FF8A65]/30"
              >
                {s.n}
              </motion.div>

              <div>
                <h3 className="mb-3 text-2xl font-black tracking-tight sm:text-3xl">{s.title}</h3>
                <p className="max-w-xl text-base leading-relaxed text-[#1a1a1a]/70">{s.desc}</p>
              </div>

              <div className="flex flex-col gap-2.5">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: 0.2 }}
                  className="max-w-[280px] self-end rounded-2xl rounded-br-md border-2 border-[#1a1a1a] bg-white px-4 py-2.5 text-sm shadow-[3px_3px_0_#1a1a1a]"
                >
                  {s.chat.user}
                </motion.div>

                {/* typing indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: [0, 1, 1, 0] }}
                  viewport={{ once: false }}
                  transition={{ duration: 1.4, delay: 0.5, times: [0, 0.2, 0.85, 1] }}
                  className="flex items-end gap-2"
                >
                  <Mascot className="h-9 w-9" />
                  <div className="flex gap-1 rounded-2xl rounded-bl-md border-2 border-[#1a1a1a] bg-white px-3 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                        className="h-1.5 w-1.5 rounded-full bg-[#1a1a1a]"
                      />
                    ))}
                  </div>
                </motion.div>

                {/* AI reply */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: 1.9 }}
                  className="flex items-end gap-2"
                >
                  <div className="shrink-0">
                    <Mascot className="h-9 w-9" />
                  </div>
                  <div className="max-w-[280px] rounded-2xl rounded-bl-md border-2 border-[#1a1a1a] bg-[#FFD180] px-4 py-2.5 text-sm shadow-[3px_3px_0_#1a1a1a]">
                    {s.chat.ai}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── PLANS — 3 pricing tiers ─── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            className="mb-3 text-center text-4xl font-black tracking-tight sm:text-5xl"
          >
            Find the OrbitOS plan<br />that fits your workflow
          </motion.h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-base text-[#1a1a1a]/60">
            OrbitOS scales with how you create, from quick clips to fully async, multi-agent studios.
            Choose the plan that gives you the speed, throughput, and model access you need.
          </p>

          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col rounded-2xl border-2 border-[#1a1a1a] bg-white p-7 transition-all hover:-translate-y-1 ${p.featured ? 'shadow-[8px_8px_0_#FF8A65]' : 'shadow-[5px_5px_0_#1a1a1a]'}`}
              >
                {p.featured && (
                  <motion.div
                    aria-hidden
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-4 -right-4 text-2xl"
                  >
                    ✨
                  </motion.div>
                )}
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#1a1a1a] text-2xl font-black"
                  style={{ background: p.accent }}
                >
                  {p.glyph}
                </motion.div>
                <h3 className="mb-2 text-2xl font-black tracking-tight">{p.name}</h3>
                <p className="mb-6 text-sm text-[#1a1a1a]/60">{p.tag}</p>
                <ul className="mb-8 space-y-3 text-sm">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a1a1a]" />
                      <span className="text-[#1a1a1a]/80">{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`mt-auto rounded-full border-2 border-[#1a1a1a] py-2.5 text-center text-sm font-bold transition-all hover:-translate-y-0.5 ${p.featured ? 'bg-[#1a1a1a] text-[#FAF7F0]' : 'bg-white text-[#1a1a1a] hover:bg-[#FFD180]'}`}
                >
                  {p.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t-2 border-[#1a1a1a]/10 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ y: [0, -4, 0], rotate: [-3, 3, -3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Mascot className="h-8 w-8" />
            </motion.div>
            <span className="text-sm font-bold">OrbitOS</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-[#1a1a1a]/60">
            <Link href="/dashboard" className="hover:text-[#1a1a1a]">Try OrbitOS</Link>
            <a href="#" className="hover:text-[#1a1a1a]">Documentation</a>
            <a href="#" className="hover:text-[#1a1a1a]">Cascade Labs</a>
            <a href="#" className="hover:text-[#1a1a1a]">Terms</a>
            <a href="#" className="hover:text-[#1a1a1a]">Privacy</a>
          </div>
        </div>
      </footer>

    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Mascot } from "@/components/mascot"
import { api } from "@/lib/api"
import type { CreatorProfile } from "@/lib/types"
import { ArrowRight, ArrowLeft, Check } from "lucide-react"

const STORAGE_KEY = "orbitos-onboarding-seen"
const PROGRESS_KEY = "orbitos-onboarding-progress"

// Canonical style options from tags.py STYLES
const STYLE_OPTIONS = [
  "humour", "wit", "storytelling", "informational", "educational",
  "personal", "hot-take", "tutorial", "inspirational", "commentary",
  "deadpan", "hype-energy",
]

const PLATFORM_OPTIONS = [
  { id: 'instagram_reels', label: 'Instagram Reels', color: '#E1306C' },
  { id: 'youtube_shorts',  label: 'YouTube Shorts',  color: '#FF0000' },
  { id: 'tiktok',          label: 'TikTok',          color: '#010101' },
  { id: 'linkedin',        label: 'LinkedIn',         color: '#0A66C2' },
]

const HOOK_STYLES = [
  { id: 'short-punchy',  label: 'Short & punchy',  desc: 'One bold line. No build-up.' },
  { id: 'setup-payoff',  label: 'Setup → payoff',  desc: 'A brief premise, then the hit.' },
  { id: 'question-led',  label: 'Question-led',    desc: '"Have you ever…" or "What if…"' },
]

const TOTAL_STEPS = 6

export type OnboardingDialogProps = {
  forceOpen?: boolean
  onClose?: () => void
  onComplete?: () => void
}

function PlatformIcon({ id }: { id: string }) {
  if (id === 'instagram_reels') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
  if (id === 'youtube_shorts') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
  if (id === 'tiktok') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.75a4.85 4.85 0 01-1.02-.06z"/>
    </svg>
  )
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

export function OnboardingDialog({ forceOpen = false, onClose, onComplete }: OnboardingDialogProps = {}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [creatorName, setCreatorName] = useState("")
  const [niche, setNiche] = useState("")

  // Step 2
  const [platforms, setPlatforms] = useState<string[]>(['instagram_reels', 'youtube_shorts', 'tiktok', 'linkedin'])

  // Step 3
  const [styles, setStyles] = useState<string[]>([])

  // Step 4
  const [audience, setAudience] = useState("")

  // Step 5
  const [hookStyle, setHookStyle] = useState("")

  // Step 6
  const [personaInspirations, setPersonaInspirations] = useState("")
  const [neverUse, setNeverUse] = useState("")

  // Load saved progress
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROGRESS_KEY)
      if (saved) {
        const p = JSON.parse(saved)
        if (p.creatorName)          setCreatorName(p.creatorName)
        if (p.niche)                setNiche(p.niche)
        if (p.platforms?.length)    setPlatforms(p.platforms)
        if (p.styles?.length)       setStyles(p.styles)
        if (p.audience)             setAudience(p.audience)
        if (p.hookStyle)            setHookStyle(p.hookStyle)
        if (p.personaInspirations)  setPersonaInspirations(p.personaInspirations)
        if (p.neverUse)             setNeverUse(p.neverUse)
        if (p.step)                 setStep(p.step)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (forceOpen || !localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(t)
    }
  }, [forceOpen])

  // Persist progress on every change
  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        step, creatorName, niche, platforms, styles, audience, hookStyle, personaInspirations, neverUse
      }))
    } catch { /* ignore */ }
  }, [step, creatorName, niche, platforms, styles, audience, hookStyle, personaInspirations, neverUse])

  function close() {
    localStorage.setItem(STORAGE_KEY, "1")
    setOpen(false)
    onClose?.()
  }

  function togglePlatform(id: string) {
    setPlatforms(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(p => p !== id) : prev  // enforce min 1
        : [...prev, id]
    )
  }

  function toggleStyle(s: string) {
    setStyles(prev =>
      prev.includes(s)
        ? prev.filter(x => x !== s)
        : prev.length < 3 ? [...prev, s] : prev  // max 3
    )
  }

  const canAdvance = [
    creatorName.trim().length > 0 && niche.trim().length > 0,  // step 1
    platforms.length >= 1,                                       // step 2
    styles.length >= 2,                                          // step 3
    audience.trim().length > 0,                                  // step 4
    hookStyle.length > 0,                                        // step 5
    true,                                                         // step 6 always ok
  ][step - 1] ?? false

  async function handleSubmit() {
    setSaving(true)
    try {
      const formData = {
        creatorName, niche, platforms, styles, audience,
        hookStyle, personaInspirations, neverUse,
      }
      const profile: CreatorProfile = {
        creator_name:      creatorName.trim(),
        niche:             niche.trim(),
        platform:          platforms[0] || 'instagram_reels',
        all_platforms:     platforms,
        styles:            styles,
        audience:          audience.trim(),
        never_use:         neverUse.trim(),
        hook_length:       hookStyle,           // repurposes hook_length column for hook_style
        voice_inspirations: personaInspirations.trim(),  // DB col stays voice_inspirations
        form_data:         formData,
      }
      await api.profile.save(profile)
      localStorage.setItem('creator_profile_data', JSON.stringify(formData))
      localStorage.setItem('creator_profile_done', '1')
      localStorage.removeItem(PROGRESS_KEY)
    } catch { /* tolerate offline backend */ }
    finally {
      setSaving(false)
      setStep(7)  // done state
    }
  }

  const stepTitles = [
    "Who are you?",
    "Where do your shorts go?",
    "What's your content vibe?",
    "Who watches you?",
    "How do you hook viewers?",
    "Any inspirations or hard limits?",
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-[#FAF7F0] px-5 py-4">
          <div className="flex items-center gap-3">
            <Mascot className="h-8 w-8" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1a1a1a]/40">
                {step <= 6 ? `Step ${step} of ${TOTAL_STEPS}` : 'All set'}
              </p>
              <p className="text-sm font-black text-[#1a1a1a]">OrbitOS Setup</p>
            </div>
          </div>
          {step <= 6 && (
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-6 rounded-full border border-[#1a1a1a] transition-all",
                    i + 1 < step  ? "bg-[#1a1a1a]" :
                    i + 1 === step ? "bg-[#FF8A65]" : "bg-white"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Step 1 — name + niche */}
        {step === 1 && (
          <StepWrapper
            title="What should we call you, and what's your YouTube channel about?"
            step={step} onBack={close} onNext={() => setStep(2)} canAdvance={canAdvance} isFirst
          >
            <input
              value={creatorName}
              onChange={e => setCreatorName(e.target.value)}
              placeholder="Your name or handle (e.g. Alex Chen)"
              className="w-full rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-sm font-medium placeholder:text-[#1a1a1a]/30 outline-none focus:border-[#FF8A65] transition-colors"
            />
            <textarea
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="Your channel niche (e.g. 'startup founder documenting building in public', 'software engineering tutorials for beginners')"
              rows={3}
              className="w-full resize-none rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-sm font-medium placeholder:text-[#1a1a1a]/30 outline-none focus:border-[#FF8A65] transition-colors"
            />
          </StepWrapper>
        )}

        {/* Step 2 — destination platforms */}
        {step === 2 && (
          <StepWrapper
            title="Where do you want to publish your shorts?"
            subtitle="YouTube is your source — pick the destinations"
            step={step} onBack={() => setStep(1)} onNext={() => setStep(3)} canAdvance={canAdvance}
          >
            <div className="grid grid-cols-2 gap-3">
              {PLATFORM_OPTIONS.map(p => {
                const active = platforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all",
                      active
                        ? "border-[#1a1a1a] bg-[#FAF7F0] shadow-[3px_3px_0_#1a1a1a]"
                        : "border-[#1a1a1a]/20 bg-white hover:border-[#1a1a1a]/50"
                    )}
                  >
                    <span style={{ color: p.color }}><PlatformIcon id={p.id} /></span>
                    {p.label}
                    {active && <Check className="ml-auto h-3.5 w-3.5 text-[#FF8A65]" />}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-[#1a1a1a]/40">Select at least one destination</p>
          </StepWrapper>
        )}

        {/* Step 3 — styles */}
        {step === 3 && (
          <StepWrapper
            title="Pick 2-3 vibes that describe your content best"
            subtitle={`${styles.length}/3 selected`}
            step={step} onBack={() => setStep(2)} onNext={() => setStep(4)} canAdvance={canAdvance}
          >
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(s => {
                const active = styles.includes(s)
                const maxed = styles.length >= 3 && !active
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStyle(s)}
                    disabled={maxed}
                    className={cn(
                      "rounded-full border-2 px-3.5 py-1.5 text-xs font-bold capitalize transition-all",
                      active
                        ? "border-[#1a1a1a] bg-[#FF8A65] text-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]"
                        : maxed
                          ? "border-[#1a1a1a]/10 bg-[#1a1a1a]/5 text-[#1a1a1a]/30 cursor-not-allowed"
                          : "border-[#1a1a1a]/20 bg-white text-[#1a1a1a]/70 hover:border-[#1a1a1a]",
                    )}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-[#1a1a1a]/40">Pick at least 2, max 3</p>
          </StepWrapper>
        )}

        {/* Step 4 — audience */}
        {step === 4 && (
          <StepWrapper
            title="Who watches you?"
            step={step} onBack={() => setStep(3)} onNext={() => setStep(5)} canAdvance={canAdvance}
          >
            <textarea
              value={audience}
              onChange={e => setAudience(e.target.value)}
              placeholder="Describe your audience (e.g. 'Developers building their first SaaS product, mostly 25-35, technical but not designers')"
              rows={4}
              className="w-full resize-none rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-sm font-medium placeholder:text-[#1a1a1a]/30 outline-none focus:border-[#FF8A65] transition-colors"
            />
          </StepWrapper>
        )}

        {/* Step 5 — hook style */}
        {step === 5 && (
          <StepWrapper
            title="How do you like to hook viewers?"
            step={step} onBack={() => setStep(4)} onNext={() => setStep(6)} canAdvance={canAdvance}
          >
            <div className="space-y-2.5">
              {HOOK_STYLES.map(h => {
                const active = hookStyle === h.id
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHookStyle(h.id)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition-all",
                      active
                        ? "border-[#1a1a1a] bg-[#FFD180] shadow-[3px_3px_0_#1a1a1a]"
                        : "border-[#1a1a1a]/15 bg-white hover:border-[#1a1a1a]"
                    )}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-black text-[#1a1a1a]">{h.label}</p>
                      <p className="mt-0.5 text-[11px] text-[#1a1a1a]/55">{h.desc}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-[#1a1a1a]" />}
                  </button>
                )
              })}
            </div>
          </StepWrapper>
        )}

        {/* Step 6 — inspirations + never use */}
        {step === 6 && (
          <StepWrapper
            title="Anyone whose short-form style you admire? Anything you'd NEVER do?"
            step={step} onBack={() => setStep(5)} onNext={handleSubmit} canAdvance={!saving} isLast saving={saving}
          >
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/50">
                Persona inspirations (1-3 names, optional)
              </label>
              <input
                value={personaInspirations}
                onChange={e => setPersonaInspirations(e.target.value)}
                placeholder="e.g. Alex Hormozi, Ali Abdaal, Lenny Rachitsky"
                className="w-full rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-sm font-medium placeholder:text-[#1a1a1a]/30 outline-none focus:border-[#FF8A65] transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/50">
                Things you'd NEVER do in your content (optional)
              </label>
              <textarea
                value={neverUse}
                onChange={e => setNeverUse(e.target.value)}
                placeholder="e.g. 'No clickbait thumbnails, never use the word guru, no hustle-porn messaging'"
                rows={3}
                className="w-full resize-none rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-sm font-medium placeholder:text-[#1a1a1a]/30 outline-none focus:border-[#FF8A65] transition-colors"
              />
            </div>
          </StepWrapper>
        )}

        {/* Done */}
        {step === 7 && (
          <div className="space-y-5 px-6 pb-8 pt-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-[#1a1a1a] bg-[#C8E6C9] shadow-[4px_4px_0_#1a1a1a]">
                <Check className="h-10 w-10 text-[#1a1a1a]" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1a1a1a]">
                You&apos;re all set{creatorName ? `, ${creatorName}` : ""}
              </h2>
              <p className="mt-2 text-sm text-[#1a1a1a]/60">
                Paste a YouTube URL — OrbitOS will find 7 moments for your week of shorts,
                shaped by your persona from day one.
              </p>
            </div>
            <Button onClick={() => { onComplete?.(); close() }} className="w-full">
              Go to dashboard
              <ArrowRight className="ms-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Step wrapper ─────────────────────────────────────────────────────────

function StepWrapper({
  title,
  subtitle,
  children,
  step,
  onBack,
  onNext,
  canAdvance,
  isFirst,
  isLast,
  saving,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  step: number
  onBack: () => void
  onNext: () => void
  canAdvance: boolean
  isFirst?: boolean
  isLast?: boolean
  saving?: boolean
}) {
  return (
    <div className="space-y-5 px-5 pb-6 pt-5">
      <DialogHeader>
        <DialogTitle className="text-base leading-snug">{title}</DialogTitle>
        {subtitle && (
          <DialogDescription className="text-xs text-[#1a1a1a]/50">{subtitle}</DialogDescription>
        )}
      </DialogHeader>

      <div className="space-y-3">{children}</div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          {isFirst ? 'Skip' : 'Back'}
        </Button>
        <Button onClick={onNext} disabled={!canAdvance}>
          {isLast
            ? (saving ? "Saving…" : "Let's go ✨")
            : <>Next <ArrowRight className="ms-1 h-4 w-4" /></>
          }
        </Button>
      </DialogFooter>
    </div>
  )
}

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
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  User,
  Calendar,
  Layers,
  MessageCircle,
  Ban,
  Type,
  Heart,
  Check,
  Link2,
  Cpu,
  SquarePen,
} from "lucide-react"

const STORAGE_KEY = "contentos-onboarding-seen"

const HOW_IT_WORKS = [
  {
    icon: Link2,
    color: "#FFD180",
    title: "Drop a YouTube URL",
    desc: "Paste any public video. ContentOS downloads, transcribes, and segments it automatically.",
  },
  {
    icon: Cpu,
    color: "#9575CD",
    title: "Cascade AI finds moments",
    desc: "The AI scores every segment for virality and writes hooks, tweets, and clip notes for each.",
  },
  {
    icon: SquarePen,
    color: "#A5D6A7",
    title: "Review and publish",
    desc: "Edit drafts inline, approve with one click. ContentOS learns your voice from every change.",
  },
]

export type OnboardingDialogProps = {
  /** When true the dialog opens immediately regardless of localStorage. */
  forceOpen?: boolean
  onClose?: () => void
  /** Called only when the user fully completes setup (not on skip/close). */
  onComplete?: () => void
}

const ROLES = ["Solo creator", "Agency", "Team", "Brand"]
const PLATFORMS = [
  { id: 'twitter',    label: 'Twitter / X',     color: '#000000' },
  { id: 'linkedin',   label: 'LinkedIn',         color: '#0A66C2' },
  { id: 'shorts',     label: 'Short-form video', color: '#FF0000' },
  { id: 'newsletter', label: 'Newsletter',        color: '#FF8A65' },
]

function PlatformLogo({ id }: { id: string }) {
  if (id === 'twitter') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231z"/>
    </svg>
  )
  if (id === 'linkedin') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
  if (id === 'shorts') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}
const CADENCE = ["Daily", "A few times a week", "Weekly", "Sporadic"]
const TONES = ["Direct", "Warm", "Playful", "Analytical", "Bold", "Witty"]
const AVOID = ["Emoji", "Hype words", "Exclamation marks", "Hashtags", "Buzzwords"]
const HOOK_LENGTHS = [
  { id: "short", label: "Short", desc: "One punchy line" },
  { id: "medium", label: "Medium", desc: "Two to three lines" },
  { id: "long", label: "Long", desc: "A short paragraph" },
]

type Stage = "welcome" | "howto" | "stage1" | "stage2" | "done"

export function OnboardingDialog({ forceOpen = false, onClose, onComplete }: OnboardingDialogProps = {}) {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>("welcome")
  const [saving, setSaving] = useState(false)

  // Stage 1
  const [creatorName, setCreatorName] = useState("")
  const [role, setRole] = useState<string>("")
  const [primaryPlatforms, setPrimaryPlatforms] = useState<string[]>([])
  const [postingCadence, setPostingCadence] = useState<string>("")

  // Stage 2
  const [tone, setTone] = useState<string[]>([])
  const [avoid, setAvoid] = useState<string[]>([])
  const [hookLength, setHookLength] = useState<string>("medium")
  const [favoriteCreators, setFavoriteCreators] = useState<string>("")

  useEffect(() => {
    if (forceOpen || !localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => {
        setOpen(true)
        setStage("welcome")
      }, 10_000)
      return () => clearTimeout(t)
    }
  }, [forceOpen])

  function close() {
    localStorage.setItem(STORAGE_KEY, "1")
    setOpen(false)
    onClose?.()
  }

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const stage1Valid =
    creatorName.trim().length > 0 &&
    role !== "" &&
    primaryPlatforms.length > 0 &&
    postingCadence !== ""

  const stage2Valid = tone.length > 0 && hookLength !== ""

  async function submitStage1() {
    // Just advance — we'll save everything together at stage2
    setStage("stage2")
  }

  async function submitStage2() {
    setSaving(true)
    try {
      const rawFormData = {
        creatorName: creatorName.trim(),
        role,
        primaryPlatforms,
        postingCadence,
        tone,
        avoid,
        hookLength,
        favoriteCreators,
      }
      const profile: CreatorProfile = {
        niche:    role.toLowerCase() || 'creator',
        platform: primaryPlatforms[0]?.toLowerCase() || 'instagram',
        all_platforms: primaryPlatforms.map(p => p.toLowerCase()),
        styles:   tone.map(t => t.toLowerCase()),
        audience: postingCadence.toLowerCase() || 'general',
        // Only things to avoid — NOT favorite creators
        never_use: avoid.join(', '),
        hook_length: hookLength,
        // Favorite creators saved as voice inspirations, not as patterns to avoid
        voice_inspirations: favoriteCreators
          .split(',')
          .map(c => c.trim())
          .filter(Boolean)
          .join(', '),
        creator_name: creatorName.trim(),
        form_data: rawFormData,
      }
      await api.profile.save(profile)
      // Persist raw form state so the Profile page can pre-populate fields
      localStorage.setItem('creator_profile_data', JSON.stringify(rawFormData))
      localStorage.setItem('creator_profile_done', '1')
    } catch {
      /* tolerate offline backend */
    } finally {
      setSaving(false)
      setStage("done")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {/* Top accent bar */}
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-[#FAF7F0] px-6 py-4">
          <div className="flex items-center gap-3">
            <Mascot className="h-9 w-9" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a1a1a]/40">
                {stage === "welcome" && "Welcome"}
                {stage === "howto" && "How it works"}
                {stage === "stage1" && "Step 1 of 2 · About you"}
                {stage === "stage2" && "Step 2 of 2 · Your voice"}
                {stage === "done" && "All set"}
              </p>
              <p className="text-sm font-black text-[#1a1a1a]">ContentOS Setup</p>
            </div>
          </div>
          {(stage === "stage1" || stage === "stage2") && (
            <div className="flex gap-1.5">
              {["stage1", "stage2"].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-2 w-8 rounded-full border border-[#1a1a1a]",
                    stage === s
                      ? "bg-[#FF8A65]"
                      : s === "stage1" && stage === "stage2"
                        ? "bg-[#1a1a1a]"
                        : "bg-white",
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── WELCOME ── */}
        {stage === "welcome" && (
          <div className="space-y-5 px-6 pb-6 pt-6">
            <div className="flex items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-[#1a1a1a] bg-[#FFD180] shadow-[4px_4px_0_#1a1a1a]">
                <Sparkles className="h-9 w-9 text-[#1a1a1a]" />
              </div>
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">Let&apos;s personalize your studio</DialogTitle>
              <DialogDescription className="text-center">
                ContentOS learns your voice over time. A quick 2-step setup helps the AI
                start out close to you — so the first drafts already feel right.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Skip for now</Button>
              <Button onClick={() => setStage("howto")}>
                Start setup
                <ArrowRight className="ms-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── HOW IT WORKS ── */}
        {stage === "howto" && (
          <div className="space-y-6 px-6 pb-6 pt-6">
            <DialogHeader>
              <DialogTitle>Here&apos;s how it works</DialogTitle>
              <DialogDescription>
                Three steps from raw video to content ready to post.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {HOW_IT_WORKS.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl border-2 border-[#1a1a1a]/10 bg-white p-4"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]"
                    style={{ background: step.color }}
                  >
                    <step.icon className="h-5 w-5 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#1a1a1a]">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#1a1a1a]/60">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStage("welcome")}>
                <ArrowLeft className="me-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStage("stage1")}>
                Set up my voice
                <ArrowRight className="ms-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STAGE 1 ── */}
        {stage === "stage1" && (
          <div className="space-y-6 px-6 pb-6 pt-6">
            <DialogHeader>
              <DialogTitle>Tell us about you</DialogTitle>
              <DialogDescription>
                This shapes which platforms ContentOS prioritizes and how often it surfaces drafts.
              </DialogDescription>
            </DialogHeader>

            <Field icon={User} label="Your name or handle">
              <input
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="e.g. Alex Chen"
                className="w-full rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2 text-sm font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#1a1a1a]"
              />
            </Field>

            <Field icon={Layers} label="You're a…">
              <ChipGroup
                options={ROLES}
                selected={role ? [role] : []}
                onToggle={(v) => setRole(v === role ? "" : v)}
                single
              />
            </Field>

            <Field icon={MessageCircle} label="Where do you post? (pick all that apply)">
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const active = primaryPlatforms.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(primaryPlatforms, p.id, setPrimaryPlatforms)}
                      className={cn(
                        "flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-all",
                        active
                          ? "border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F0] shadow-[2px_2px_0_#1a1a1a]"
                          : "border-[#1a1a1a]/20 bg-white text-[#1a1a1a]/70 hover:border-[#1a1a1a]",
                      )}
                    >
                      <span style={{ color: p.color }}><PlatformLogo id={p.id} /></span>
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field icon={Calendar} label="Posting cadence">
              <ChipGroup
                options={CADENCE}
                selected={postingCadence ? [postingCadence] : []}
                onToggle={(v) => setPostingCadence(v === postingCadence ? "" : v)}
                single
              />
            </Field>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStage("howto")}>
                <ArrowLeft className="me-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={submitStage1} disabled={!stage1Valid || saving}>
                {saving ? "Saving…" : "Continue"}
                <ArrowRight className="ms-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STAGE 2 ── */}
        {stage === "stage2" && (
          <div className="space-y-6 px-6 pb-6 pt-6">
            <DialogHeader>
              <DialogTitle>How should drafts sound?</DialogTitle>
              <DialogDescription>
                The AI starts here, then learns from every edit. You can change these anytime.
              </DialogDescription>
            </DialogHeader>

            <Field icon={Type} label="Tone (pick a few)">
              <ChipGroup options={TONES} selected={tone} onToggle={(v) => toggle(tone, v, setTone)} />
            </Field>

            <Field icon={Ban} label="What should the AI avoid?">
              <ChipGroup options={AVOID} selected={avoid} onToggle={(v) => toggle(avoid, v, setAvoid)} />
            </Field>

            <Field icon={MessageCircle} label="Default hook length">
              <div className="grid gap-2 sm:grid-cols-3">
                {HOOK_LENGTHS.map((h) => {
                  const active = hookLength === h.id
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHookLength(h.id)}
                      className={cn(
                        "rounded-xl border-2 p-3 text-left transition-all",
                        active
                          ? "border-[#1a1a1a] bg-[#FFD180] shadow-[3px_3px_0_#1a1a1a]"
                          : "border-[#1a1a1a]/15 bg-white hover:border-[#1a1a1a]",
                      )}
                    >
                      <p className="text-sm font-black">{h.label}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-[#1a1a1a]/55">{h.desc}</p>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field icon={Heart} label="Creators whose voice you admire (comma-separated, optional)">
              <input
                value={favoriteCreators}
                onChange={(e) => setFavoriteCreators(e.target.value)}
                placeholder="e.g. Naval, Sahil Bloom, Justin Welsh"
                className="w-full rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2 text-sm font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#1a1a1a]"
              />
            </Field>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStage("stage1")}>
                <ArrowLeft className="me-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={submitStage2} disabled={!stage2Valid || saving}>
                {saving ? "Saving…" : "Finish"}
                <Check className="ms-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── DONE ── */}
        {stage === "done" && (
          <div className="space-y-5 px-6 pb-6 pt-6">
            <div className="flex items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-[#1a1a1a] bg-[#C8E6C9] shadow-[4px_4px_0_#1a1a1a]">
                <Check className="h-10 w-10 text-[#1a1a1a]" />
              </div>
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">
                You&apos;re all set{creatorName ? `, ${creatorName}` : ""}
              </DialogTitle>
              <DialogDescription className="text-center">
                Drop a YouTube link to see your first batch of drafts — already biased toward your voice.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => { onComplete?.(); close() }}>
                Go to dashboard
                <ArrowRight className="ms-1 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a1a1a]/55">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </label>
      {children}
    </div>
  )
}

function ChipGroup({
  options,
  selected,
  onToggle,
  single = false,
}: {
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  single?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              "rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-all",
              active
                ? "border-[#1a1a1a] bg-[#FF8A65] text-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]"
                : "border-[#1a1a1a]/20 bg-white text-[#1a1a1a]/70 hover:border-[#1a1a1a]",
            )}
          >
            {single && active && <Check className="me-1 inline h-3 w-3" />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

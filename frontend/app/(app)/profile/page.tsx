'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, Layers, MessageCircle, Calendar, Type, Ban, Heart, Check,
  SlidersHorizontal, Save, RefreshCw,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { CreatorProfile } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Same constants as onboarding ─────────────────────────────────────────
const ROLES     = ['Solo creator', 'Agency', 'Team', 'Brand']
const PLATFORMS = [
  { id: 'twitter',    label: 'Twitter / X',     color: '#000000' },
  { id: 'linkedin',   label: 'LinkedIn',        color: '#0A66C2' },
  { id: 'shorts',     label: 'Short-form video',color: '#FF0000' },
  { id: 'newsletter', label: 'Newsletter',       color: '#FF8A65' },
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
const CADENCE      = ['Daily', 'A few times a week', 'Weekly', 'Sporadic']
const TONES        = ['Direct', 'Warm', 'Playful', 'Analytical', 'Bold', 'Witty']
const AVOID        = ['Emoji', 'Hype words', 'Exclamation marks', 'Hashtags', 'Buzzwords']
const HOOK_LENGTHS = [
  { id: 'short',  label: 'Short',  desc: 'One punchy line' },
  { id: 'medium', label: 'Medium', desc: 'Two to three lines' },
  { id: 'long',   label: 'Long',   desc: 'A short paragraph' },
]

const LOCAL_KEY = 'creator_profile_data'

interface FormState {
  creatorName: string
  role: string
  primaryPlatforms: string[]
  postingCadence: string
  tone: string[]
  avoid: string[]
  hookLength: string
  favoriteCreators: string
}

const DEFAULTS: FormState = {
  creatorName: '',
  role: '',
  primaryPlatforms: [],
  postingCadence: '',
  tone: [],
  avoid: [],
  hookLength: 'medium',
  favoriteCreators: '',
}

// ── Helpers ──────────────────────────────────────────────────────────────
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
    <div className="space-y-2.5">
      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a1a1a]/55">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </label>
      {children}
    </div>
  )
}

function ChipGroup({
  options, selected, onToggle, single = false,
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  single?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              'rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-all',
              active
                ? 'border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F0] shadow-[2px_2px_0_#1a1a1a]'
                : 'border-[#1a1a1a]/20 bg-white text-[#1a1a1a]/70 hover:border-[#1a1a1a]',
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [form, setForm]       = useState<FormState>(DEFAULTS)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [loaded, setLoaded]   = useState(false)

  // Load saved values: API (Supabase) first, localStorage as fallback
  useEffect(() => {
    async function load() {
      try {
        const res = await api.profile.get()
        if (res.has_profile && res.profile?.form_data) {
          const fd = res.profile.form_data as Record<string, unknown>
          setForm({ ...DEFAULTS, ...fd })
          // Keep localStorage in sync
          localStorage.setItem(LOCAL_KEY, JSON.stringify(fd))
          setLoaded(true)
          return
        }
      } catch { /* backend unreachable */ }
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem(LOCAL_KEY)
        if (raw) setForm({ ...DEFAULTS, ...JSON.parse(raw) })
      } catch { /* ignore */ }
      setLoaded(true)
    }
    load()
  }, [])

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  function toggle(key: 'tone' | 'avoid' | 'primaryPlatforms', val: string) {
    set(key, form[key].includes(val)
      ? (form[key] as string[]).filter(v => v !== val)
      : [...(form[key] as string[]), val]
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const profile: CreatorProfile = {
        niche:             form.role.toLowerCase() || 'creator',
        platform:          form.primaryPlatforms[0]?.toLowerCase() || 'instagram',
        all_platforms:     form.primaryPlatforms.map(p => p.toLowerCase()),
        styles:            form.tone.map(t => t.toLowerCase()),
        audience:          form.postingCadence.toLowerCase() || 'general',
        never_use:         form.avoid.join(', '),
        hook_length:       form.hookLength,
        voice_inspirations: form.favoriteCreators
          .split(',').map(c => c.trim()).filter(Boolean).join(', '),
        creator_name:      form.creatorName.trim(),
        form_data:         { ...form },
      }
      await api.profile.save(profile)
      localStorage.setItem(LOCAL_KEY, JSON.stringify(form))
      localStorage.setItem('creator_profile_done', '1')
      setSaved(true)
    } catch { /* tolerate offline */ }
    finally { setSaving(false) }
  }

  if (!loaded) return null

  const isValid = form.creatorName.trim().length > 0 && form.tone.length > 0

  return (
    <div className="space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#FF8A65] shadow-[3px_3px_0_#1a1a1a]">
            <SlidersHorizontal className="h-5 w-5 text-[#1a1a1a]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1a1a1a]">
              {form.creatorName ? `${form.creatorName}'s Profile` : 'Creator Profile'}
            </h1>
            <p className="text-xs font-semibold text-[#1a1a1a]/45">
              Update your voice preferences — changes are reflected in future drafts
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !isValid}
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 border-[#1a1a1a] px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_#1a1a1a] transition-all',
            saved
              ? 'bg-[#A5D6A7] text-[#1a1a1a]'
              : 'bg-[#FFD180] text-[#1a1a1a] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1a1a1a]',
            'disabled:opacity-50 disabled:shadow-[3px_3px_0_#1a1a1a] disabled:translate-x-0 disabled:translate-y-0',
          )}
        >
          {saving ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="h-4 w-4" /> Saved</>
          ) : (
            <><Save className="h-4 w-4" /> Save Changes</>
          )}
        </button>
      </motion.div>

      {/* ── Section: About you ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-white shadow-[4px_4px_0_#1a1a1a]">
        <div className="border-b-2 border-[#1a1a1a] bg-[#FAF7F0] px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1a1a1a]/50">About you</p>
          <p className="text-sm font-black text-[#1a1a1a]">Identity & platforms</p>
        </div>
        <div className="space-y-6 px-6 py-6">

          <Field icon={User} label="Your name or handle">
            <input
              value={form.creatorName}
              onChange={e => set('creatorName', e.target.value)}
              placeholder="e.g. Alex Chen"
              className="w-full rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#1a1a1a]"
            />
          </Field>

          <Field icon={Layers} label="You're a…">
            <ChipGroup
              options={ROLES}
              selected={form.role ? [form.role] : []}
              onToggle={v => set('role', v === form.role ? '' : v)}
              single
            />
          </Field>

          <Field icon={MessageCircle} label="Where do you post? (pick all that apply)">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => {
                const active = form.primaryPlatforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle('primaryPlatforms', p.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-all',
                      active
                        ? 'border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F0] shadow-[2px_2px_0_#1a1a1a]'
                        : 'border-[#1a1a1a]/20 bg-white text-[#1a1a1a]/70 hover:border-[#1a1a1a]',
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
              selected={form.postingCadence ? [form.postingCadence] : []}
              onToggle={v => set('postingCadence', v === form.postingCadence ? '' : v)}
              single
            />
          </Field>

        </div>
      </motion.div>

      {/* ── Section: Voice ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-white shadow-[4px_4px_0_#1a1a1a]">
        <div className="border-b-2 border-[#1a1a1a] bg-[#FAF7F0] px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1a1a1a]/50">Voice & style</p>
          <p className="text-sm font-black text-[#1a1a1a]">How your drafts should sound</p>
        </div>
        <div className="space-y-6 px-6 py-6">

          <Field icon={Type} label="Tone (pick a few)">
            <ChipGroup options={TONES} selected={form.tone} onToggle={v => toggle('tone', v)} />
          </Field>

          <Field icon={Ban} label="What should the AI avoid?">
            <ChipGroup options={AVOID} selected={form.avoid} onToggle={v => toggle('avoid', v)} />
          </Field>

          <Field icon={MessageCircle} label="Default hook length">
            <div className="grid gap-2 sm:grid-cols-3">
              {HOOK_LENGTHS.map(h => {
                const active = form.hookLength === h.id
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => set('hookLength', h.id)}
                    className={cn(
                      'rounded-xl border-2 p-3 text-left transition-all',
                      active
                        ? 'border-[#1a1a1a] bg-[#FFD180] shadow-[3px_3px_0_#1a1a1a]'
                        : 'border-[#1a1a1a]/15 bg-[#FAF7F0] hover:border-[#1a1a1a]',
                    )}
                  >
                    <p className="text-sm font-black text-[#1a1a1a]">{h.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-[#1a1a1a]/55">{h.desc}</p>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field icon={Heart} label="Creators whose voice you admire (comma-separated)">
            <input
              value={form.favoriteCreators}
              onChange={e => set('favoriteCreators', e.target.value)}
              placeholder="e.g. Naval, Sahil Bloom, Justin Welsh"
              className="w-full rounded-lg border-2 border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#1a1a1a]"
            />
          </Field>

        </div>
      </motion.div>

      {/* Bottom save button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saving || !isValid}
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 border-[#1a1a1a] px-6 py-3 text-sm font-bold shadow-[3px_3px_0_#1a1a1a] transition-all',
            saved
              ? 'bg-[#A5D6A7] text-[#1a1a1a]'
              : 'bg-[#FFD180] text-[#1a1a1a] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1a1a1a]',
            'disabled:opacity-50',
          )}
        >
          {saving ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="h-4 w-4" /> Changes saved</>
          ) : (
            <><Save className="h-4 w-4" /> Save Changes</>
          )}
        </button>
      </motion.div>

    </div>
  )
}

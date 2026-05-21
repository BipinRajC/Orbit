'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

interface Props {
  onComplete: () => void
}

const NICHES = ['Fitness', 'Business', 'Tech', 'Lifestyle', 'Education', 'Other']
const PLATFORMS = ['Instagram', 'YouTube', 'LinkedIn', 'TikTok']
const STYLES = ['Energetic', 'Calm', 'Motivational', 'Educational', 'Funny', 'Raw / Authentic']
const AUDIENCES = ['Beginners', 'Intermediate', 'Enthusiasts / Advanced', 'Professionals']

export function CreatorProfileModal({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [niche, setNiche] = useState('')
  const [platform, setPlatform] = useState('')
  const [styles, setStyles] = useState<string[]>([])
  const [audience, setAudience] = useState('')
  const [neverUse, setNeverUse] = useState('')
  const [saving, setSaving] = useState(false)

  const steps = [
    { label: "What's your niche?", options: NICHES, value: niche, set: setNiche, multi: false },
    { label: 'Your primary platform?', options: PLATFORMS, value: platform, set: setPlatform, multi: false },
    { label: 'Your content style? (pick up to 3)', options: STYLES, value: styles, set: setStyles as any, multi: true },
    { label: 'Who is your audience?', options: AUDIENCES, value: audience, set: setAudience, multi: false },
  ]

  const current = steps[step]
  const isLastStep = step === steps.length

  function toggleStyle(s: string) {
    setStyles(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : prev.length < 3 ? [...prev, s] : prev
    )
  }

  function canAdvance() {
    if (step === 0) return !!niche
    if (step === 1) return !!platform
    if (step === 2) return styles.length > 0
    if (step === 3) return !!audience
    return true
  }

  async function handleFinish() {
    setSaving(true)
    try {
      await api.profile.save({
        niche: niche.toLowerCase(),
        platform: platform.toLowerCase(),
        styles: styles.map(s => s.toLowerCase()),
        audience: audience.toLowerCase(),
        never_use: neverUse,
      })
      localStorage.setItem('creator_profile_done', '1')
      onComplete()
    } catch {
      onComplete() // don't block on failure
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-3 flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-zinc-900' : 'bg-zinc-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-zinc-400">
            {isLastStep ? 'Almost done' : `Step ${step + 1} of ${steps.length + 1}`}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">
            {isLastStep
              ? 'Anything you never want in your content?'
              : current.label}
          </h2>
          {!isLastStep && step === 2 && (
            <p className="mt-0.5 text-xs text-zinc-400">Selected: {styles.length}/3</p>
          )}
        </div>

        {/* Options */}
        {!isLastStep ? (
          <div className="flex flex-wrap gap-2">
            {current.options.map(opt => {
              const isSelected = current.multi
                ? (current.value as string[]).includes(opt)
                : current.value === opt
              return (
                <button
                  key={opt}
                  onClick={() =>
                    current.multi ? toggleStyle(opt) : (current.set as (v: string) => void)(opt)
                  }
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        ) : (
          <div>
            <textarea
              value={neverUse}
              onChange={e => setNeverUse(e.target.value)}
              placeholder="e.g. clickbait phrases, aggressive openers, political topics... (optional)"
              rows={3}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 resize-none"
            />
            <p className="mt-1.5 text-xs text-zinc-400">
              This is optional — skip if nothing comes to mind.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-sm text-zinc-400 hover:text-zinc-600"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="text-sm text-zinc-400 hover:text-zinc-600"
            >
              Skip
            </button>
          )}

          {isLastStep ? (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Done — start creating'}
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

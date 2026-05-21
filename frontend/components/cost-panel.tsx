'use client'

import React, { useState } from 'react'
import type { CostLog } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DollarSign, ChevronDown, Zap, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  costLog: CostLog | Record<string, never>
  defaultOpen?: boolean
}

export function CostPanel({ costLog, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const log = costLog as CostLog
  if (!log.total_calls) return null

  const savingsPct = log.drafter_pct ?? 0

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-white shadow-[4px_4px_0_#1a1a1a]">

      {/* ── Header ── */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between bg-white px-5 py-4 text-left transition-colors hover:bg-[#FAF7F0]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#A5D6A7] shadow-[2px_2px_0_#1a1a1a]">
            <DollarSign className="h-4 w-4 text-[#1a1a1a]" />
          </div>
          <div>
            <span className="text-sm font-black text-[#1a1a1a]">Cost Panel</span>
            <span className="ml-2.5 inline-flex items-center rounded-full border border-[#1a1a1a]/20 bg-[#C8E6C9] px-2 py-0.5 text-[10px] font-bold text-[#1a1a1a]">
              ${log.total_cost_usd?.toFixed(4)} total
            </span>
          </div>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-[#1a1a1a]/40 transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-4 border-t-2 border-[#1a1a1a]/10 px-5 pb-5 pt-4">

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat label="Total calls"    value={String(log.total_calls)}                            color="#E3F2FD" />
                <Stat label="Fast model"     value={`${log.drafter_calls} calls`}                      color="#C8E6C9" />
                <Stat label="Quality model"  value={`${log.verifier_calls} calls`}                     color="#E1BEE7" />
                <Stat label="Saved"          value={`$${log.estimated_savings_usd?.toFixed(4)}`}        color="#FFE0B2" />
              </div>

              {/* Routing split bar */}
              <div className="rounded-xl border-2 border-[#1a1a1a]/10 bg-[#FAF7F0] p-4">
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">
                  cascadeflow routing split
                </p>
                <div className="flex h-3 overflow-hidden rounded-full border border-[#1a1a1a]/15 bg-[#1a1a1a]/5">
                  <motion.div
                    className="rounded-l-full bg-[#A5D6A7]"
                    initial={{ width: 0 }}
                    animate={{ width: `${savingsPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                  <div className="flex-1 rounded-r-full bg-[#CE93D8]" />
                </div>
                <div className="mt-2 flex justify-between text-[10px] font-bold text-[#1a1a1a]/50">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#A5D6A7] border border-[#1a1a1a]/20" />
                    Fast model — {savingsPct}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#CE93D8] border border-[#1a1a1a]/20" />
                    Quality model — {100 - savingsPct}%
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold text-[#1a1a1a]">
                  {savingsPct}% of calls handled by fast model — saved{' '}
                  <span className="text-[#388E3C]">${log.estimated_savings_usd?.toFixed(4)}</span> vs routing everything to the quality model.
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a]/10 p-3" style={{ background: color }}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">{label}</p>
      <p className="text-sm font-black text-[#1a1a1a]">{value}</p>
    </div>
  )
}

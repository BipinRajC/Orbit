import type { CostLog } from '@/lib/types'

interface Props {
  costLog: CostLog | Record<string, never>
  defaultOpen?: boolean
}

export function CostPanel({ costLog, defaultOpen = false }: Props) {
  const log = costLog as CostLog
  if (!log.total_calls) {
    return null
  }

  return (
    <details open={defaultOpen} className="group rounded-xl border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer select-none items-center justify-between p-4 text-sm font-medium text-zinc-700 hover:text-zinc-900">
        <span className="flex items-center gap-2">
          <span>Cost Panel</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
            ${log.total_cost_usd?.toFixed(4)} total
          </span>
        </span>
        <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total calls" value={String(log.total_calls)} />
          <Stat label="Fast model" value={`${log.drafter_calls} (${log.drafter_pct}%)`} />
          <Stat label="Quality model" value={String(log.verifier_calls)} />
          <Stat label="Saved vs always-expensive" value={`$${log.estimated_savings_usd?.toFixed(4)}`} />
        </div>

        {/* Routing bar */}
        {log.total_calls > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-zinc-400">Routing split</p>
            <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="bg-emerald-400 transition-all"
                style={{ width: `${log.drafter_pct}%` }}
              />
              <div className="flex-1 bg-violet-300" />
            </div>
            <div className="mt-1 flex justify-between text-xs text-zinc-400">
              <span>Fast model ({log.drafter_pct}%)</span>
              <span>Quality model ({100 - (log.drafter_pct ?? 0)}%)</span>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-800">{value}</p>
    </div>
  )
}

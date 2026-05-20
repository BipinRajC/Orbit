import type { MemoryContext } from '@/lib/types'

interface Props {
  memoryContext: MemoryContext | Record<string, never>
  defaultOpen?: boolean
}

export function IntelligencePanel({ memoryContext, defaultOpen = false }: Props) {
  const ctx = memoryContext as MemoryContext

  const hasMemory = ctx.recall_count > 0

  return (
    <details open={defaultOpen} className="group rounded-xl border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer select-none items-center justify-between p-4 text-sm font-medium text-zinc-700 hover:text-zinc-900">
        <span className="flex items-center gap-2">
          <span>Intelligence Panel</span>
          {hasMemory ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
              {ctx.recall_count} memories
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              No prior memory
            </span>
          )}
        </span>
        <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <div className="space-y-4 border-t border-zinc-100 px-4 pb-4 pt-3">

        {/* Memory recall */}
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Memory Recall
          </p>
          {hasMemory ? (
            <ul className="space-y-1">
              {ctx.recall_items?.map((item, i) => (
                <li key={i} className="text-xs text-zinc-600 pl-3 border-l-2 border-violet-200">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-400">
              No prior memory — generated with universal heuristics. Complete a review to start building creator memory.
            </p>
          )}
        </div>

        {/* Reflection synthesis */}
        {ctx.reflection && (
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
              Creator Synthesis
            </p>
            <p className="text-xs text-zinc-600 leading-relaxed">{ctx.reflection}</p>
          </div>
        )}

        {/* Generation influence */}
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Generation Influence
          </p>
          <p className="text-xs text-zinc-600">
            {ctx.biases_applied > 0
              ? `Applied ${ctx.biases_applied} memory-based biases to prompt construction.`
              : 'No memory-based biases applied — first session baseline.'}
          </p>
        </div>
      </div>
    </details>
  )
}

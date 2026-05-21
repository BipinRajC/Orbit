import type { ProcessingLogEntry } from '@/lib/types'

interface Props {
  log: ProcessingLogEntry[]
  status: string
}

const STAGE_LABELS: Record<string, string> = {
  ingest: 'Ingesting',
  transcribe: 'Transcribing',
  recall: 'Recalling memory',
  extract: 'Finding moments',
  generate: 'Generating content',
  complete: 'Complete',
  error: 'Error',
  memory_synthesis: 'Synthesising memory',
}

export function ProgressStream({ log, status }: Props) {
  if (!log || log.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs text-zinc-400">Pipeline starting...</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <p className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
        Processing log
      </p>
      <ol className="space-y-2">
        {log.map((entry, i) => {
          const isLast = i === log.length - 1
          const isError = entry.stage === 'error'
          return (
            <li key={i} className="flex items-start gap-2">
              <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                isError ? 'bg-red-400' : isLast && status === 'processing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`} />
              <div>
                <span className="text-xs font-medium text-zinc-600">
                  {STAGE_LABELS[entry.stage] ?? entry.stage}:{' '}
                </span>
                <span className="text-xs text-zinc-500">{entry.message}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

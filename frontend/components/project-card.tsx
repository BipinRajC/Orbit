import Link from 'next/link'
import type { ProjectListItem } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Queued',
  processing: 'Processing',
  ready_for_review: 'Ready for review',
  archived: 'Reviewed',
}

const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-zinc-100 text-zinc-500',
  processing: 'bg-amber-50 text-amber-600',
  ready_for_review: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-zinc-100 text-zinc-400',
}

interface Props {
  project: ProjectListItem
}

export function ProjectCard({ project }: Props) {
  const label = STATUS_LABELS[project.status] ?? project.status
  const color = STATUS_COLORS[project.status] ?? 'bg-zinc-100 text-zinc-500'
  const date = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">
            {project.title ?? 'Untitled'}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            {project.source_url}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
        <span>{date}</span>
        {project.moment_count > 0 && (
          <span>{project.moment_count} moments</span>
        )}
        {project.status === 'processing' && (
          <span className="animate-pulse">In progress...</span>
        )}
      </div>
    </Link>
  )
}

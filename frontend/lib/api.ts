import type {
  Project,
  ProjectListItem,
  Derivative,
  VideoIntent,
  CreatorProfile,
  IntelligenceGraph,
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Simple TTL cache — avoids redundant API fetches on page navigation
// ---------------------------------------------------------------------------
interface CacheEntry { data: unknown; ts: number; inflight?: Promise<unknown> }
const _cache = new Map<string, CacheEntry>()

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key)
  // Return cached data if still fresh
  if (hit && !hit.inflight && Date.now() - hit.ts < ttlMs) {
    return Promise.resolve(hit.data as T)
  }
  // Deduplicate in-flight requests for the same key
  if (hit?.inflight) return hit.inflight as Promise<T>

  const promise = fn().then(data => {
    _cache.set(key, { data, ts: Date.now() })
    return data
  }).catch(err => {
    // On error, clear the entry so the next call retries
    _cache.delete(key)
    throw err
  })

  _cache.set(key, { data: hit?.data, ts: hit?.ts ?? 0, inflight: promise })
  return promise
}

/** Synchronously check whether a cache entry is valid (no async round-trip). */
export function isCacheWarm(key: string, ttlMs: number): boolean {
  const hit = _cache.get(key)
  return !!(hit && !hit.inflight && Date.now() - hit.ts < ttlMs)
}

/** Invalidate all cache entries whose key starts with `prefix`. */
function bust(prefix: string) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}

/** Bust a specific exact cache entry — used for manual refresh. */
export function bustCache(key: string) {
  _cache.delete(key)
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const api = {
  projects: {
    create: (url: string, targetPlatforms?: string[], videoIntent?: VideoIntent): Promise<ProjectListItem> =>
      request<ProjectListItem>('/projects', {
        method: 'POST',
        body: JSON.stringify({ url, target_platforms: targetPlatforms ?? null, video_intent: videoIntent ?? null }),
      }).then(p => { bust('projects/'); return p }),

    list: (): Promise<ProjectListItem[]> =>
      cached('projects/list', 15_000, () => request('/projects')),

    get: (id: string): Promise<Project> =>
      cached(`projects/${id}`, 20_000, () => request(`/projects/${id}`)),

    completeReview: (id: string): Promise<{ message: string; project_id: string; observations_saved?: number }> =>
      request<{ message: string; project_id: string }>(`/projects/${id}/complete-review`, { method: 'POST' })
        .then(r => { bust(`projects/${id}`); bust('projects/list'); return r }),

    delete: (id: string): Promise<void> =>
      request<void>(`/projects/${id}`, { method: 'DELETE' })
        .then(() => { bust('projects/'); bust(`projects/${id}`) }),
  },

  derivatives: {
    edit: (id: string, content: string): Promise<Derivative> =>
      request(`/derivatives/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),

    approve: (id: string): Promise<Derivative> =>
      request(`/derivatives/${id}/approve`, { method: 'POST' }),

    reject: (id: string): Promise<Derivative> =>
      request(`/derivatives/${id}/reject`, { method: 'POST' }),

    regenerate: (id: string, guidance?: string, section?: string): Promise<Derivative> =>
      request(`/derivatives/${id}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ guidance: guidance ?? null, section: section ?? null }),
      }),
  },

  clips: {
    exportVertical: (projectId: string, momentId: string): Promise<{ url: string }> =>
      request(`/clips/${projectId}/${momentId}/export`, { method: 'POST' }),
  },

  profile: {
    save: (profile: CreatorProfile): Promise<{ stored: number }> =>
      request('/profile', {
        method: 'POST',
        body: JSON.stringify(profile),
      }),

    get: (): Promise<{ has_profile: boolean; profile: Record<string, unknown> | null }> =>
      request('/profile'),

    status: (): Promise<{ has_profile: boolean }> =>
      cached('profile/status', 60_000, () => request('/profile/status')),
  },

  intelligence: {
    reflect: () => request('/intelligence/reflect') as Promise<{
      reflection: string; recall_count: number; recall_items: string[]
    }>,
    graph: (_projectId: string): Promise<IntelligenceGraph> =>
      cached('intelligence/graph', 60_000, () => request('/intelligence/graph')),
  },
}

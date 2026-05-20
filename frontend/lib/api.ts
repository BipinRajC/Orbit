import type {
  Project,
  ProjectListItem,
  Derivative,
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
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const api = {
  projects: {
    create: (url: string, targetPlatforms?: string[]): Promise<ProjectListItem> =>
      request('/projects', {
        method: 'POST',
        body: JSON.stringify({ url, target_platforms: targetPlatforms ?? null }),
      }),

    list: (): Promise<ProjectListItem[]> =>
      request('/projects'),

    get: (id: string): Promise<Project> =>
      request(`/projects/${id}`),

    completeReview: (id: string): Promise<{ message: string; project_id: string }> =>
      request(`/projects/${id}/complete-review`, { method: 'POST' }),
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

    regenerate: (id: string, guidance?: string): Promise<Derivative> =>
      request(`/derivatives/${id}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ guidance: guidance ?? null }),
      }),
  },
}

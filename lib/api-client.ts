/**
 * lib/api-client.ts — browser-side fetch helper for /api/*. Isomorphic module (no server
 * imports); client components use `apiFetch` for every server call and never talk to
 * Supabase tables directly (docs/CONTRACTS.md §5.3).
 */
import type { ZodIssue } from 'zod'
import type { ApiFailure, ApiSuccess } from '@/types/api'

export class ApiClientError extends Error {
  status: number
  issues?: ZodIssue[]

  constructor(message: string, status: number, issues?: ZodIssue[]) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.issues = issues
  }
}

function isFailure(body: unknown): body is ApiFailure {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'object' &&
    (body as { error: unknown }).error !== null
  )
}

/**
 * Fetches an API route and unwraps the `{ data }` envelope. Pass `json` to send a JSON body
 * (sets Content-Type). Forwards every RequestInit field, including `keepalive` (playlist
 * autosave flushes on unmount rely on it). Throws ApiClientError on `{ error }` or non-2xx.
 */
export async function apiFetch<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {}
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (isFailure(body)) {
    throw new ApiClientError(body.error.message, response.status, body.error.issues)
  }
  if (!response.ok) {
    throw new ApiClientError(`Request failed (${response.status})`, response.status)
  }
  return (body as ApiSuccess<T>).data
}

/** '?a=b&c=1' from defined params; skips undefined/null/'' and false; '' when nothing remains. */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

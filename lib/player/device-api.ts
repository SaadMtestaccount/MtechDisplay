/**
 * lib/player/device-api.ts — the player's only HTTP surface (docs/CONTRACTS.md §10).
 * Plain same-origin fetches against /api/device/* unwrapping the { data } envelope.
 * Every failure throws DeviceApiError; `status: 0` means network error / timeout.
 */
import type {
  HeartbeatRequest,
  HeartbeatResponse,
  Manifest,
  PairingCodeResponse,
  PairingStatusResponse,
  PlayerDeviceState,
} from '@/types/api'

const REQUEST_TIMEOUT_MS = 20_000

export class DeviceApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DeviceApiError'
    this.status = status
  }
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const err = (body as { error: unknown }).error
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const message = (err as { message: unknown }).message
      if (typeof message === 'string' && message.length > 0) return message
    }
  }
  return `Request failed with status ${status}`
}

async function deviceFetch<T>(path: string, init?: RequestInit & { json?: unknown; token?: string }): Promise<T> {
  const headers = new Headers(init?.headers)
  let body: BodyInit | undefined
  if (init?.json !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(init.json)
  }
  if (init?.token) headers.set('authorization', `Bearer ${init.token}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers,
      body,
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch {
    throw new DeviceApiError(0, 'Network error')
  } finally {
    clearTimeout(timeout)
  }

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    // non-JSON body (proxy error page); fall through to the status check
  }
  if (!response.ok) throw new DeviceApiError(response.status, errorMessage(parsed, response.status))
  if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
    return (parsed as { data: T }).data
  }
  throw new DeviceApiError(response.status, 'Malformed response')
}

export function requestPairingCode(fingerprint: string): Promise<PairingCodeResponse> {
  return deviceFetch<PairingCodeResponse>('/api/device/pairing-code', { method: 'POST', json: { fingerprint } })
}

export function pollPairingStatus(code: string, fingerprint: string): Promise<PairingStatusResponse> {
  const query = `?fingerprint=${encodeURIComponent(fingerprint)}`
  return deviceFetch<PairingStatusResponse>(`/api/device/pairing-status/${encodeURIComponent(code)}${query}`)
}

/** Merchant flow: session-cookie authed; mints this device's token (returned once). */
export function selfClaim(fingerprint: string): Promise<PlayerDeviceState> {
  return deviceFetch<PlayerDeviceState>('/api/device/self-claim', { method: 'POST', json: { fingerprint } })
}

export function fetchManifest(token: string): Promise<Manifest> {
  return deviceFetch<Manifest>('/api/device/manifest', { token })
}

export function sendHeartbeat(token: string, body: HeartbeatRequest): Promise<HeartbeatResponse> {
  return deviceFetch<HeartbeatResponse>('/api/device/heartbeat', { method: 'POST', json: body, token })
}

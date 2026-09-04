/**
 * lib/player/player-storage.ts — the player's localStorage keys and safe JSON helpers,
 * plus `newId()` (docs/CONTRACTS.md §10). Every read/write is wrapped: a TV browser with
 * storage disabled must degrade to an in-memory session, never crash.
 */
export const DEVICE_KEY = 'msign.device'
export const MANIFEST_KEY = 'msign.manifest'
export const FINGERPRINT_KEY = 'msign.fingerprint'
export const PENDING_KEY = 'msign.pending'

/**
 * A TV opened with `/player?code=XXXX` (a browser-driven monitor from the portal) uses per-tab
 * sessionStorage, so several such tabs on one computer are independent screens instead of fighting
 * over one origin's localStorage. A normal TV (no ?code) uses persistent localStorage.
 */
function playerStore(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.location.search.includes('code=') ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const store = playerStore()
    if (!store) return null
    const raw = store.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    const store = playerStore()
    if (!store) return
    store.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[player] storage write failed', key, e)
  }
}

export function remove(key: string): void {
  try {
    const store = playerStore()
    if (!store) return
    store.removeItem(key)
  } catch {
    // ignore
  }
}

/**
 * v4-shaped uuid that also works in insecure contexts (http://<lan-ip>:3000/player):
 * `crypto.randomUUID` is secure-context-only, so fall back to `getRandomValues`, then
 * to Math.random as a last resort. The player never calls crypto.randomUUID directly.
 */
export function newId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) {
    try {
      return c.randomUUID()
    } catch {
      // fall through — some engines expose the property but throw outside secure contexts
    }
  }
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

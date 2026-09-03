/**
 * lib/player/backoff.ts — pure retry backoff for the player (docs/CONTRACTS.md §10).
 * `nextDelay(attempt)` = min(5000 * 2^attempt, 60000): 5s, 10s, 20s, 40s, 60s, 60s…
 * Callers reset their attempt counter on success.
 */
export const BACKOFF_BASE_MS = 5_000
export const BACKOFF_MAX_MS = 60_000

export function nextDelay(attempt: number): number {
  const safe = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0
  return Math.min(BACKOFF_BASE_MS * 2 ** safe, BACKOFF_MAX_MS)
}

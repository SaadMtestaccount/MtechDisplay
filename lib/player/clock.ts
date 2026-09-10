/**
 * lib/player/clock.ts — BROWSER ONLY. The player's server-aligned clock for synchronized playback
 * (docs/CONTRACTS.md §21). TV boxes drift by seconds or minutes, so every TV keeps an offset
 * between its own clock and the server's, fed by the manifest's `generated_at` and each
 * heartbeat's `server_time`; `syncedNow()` is what the synced engine and drift correction use.
 * Network latency (~100 ms) is ignored — well inside the 0.5 s drift tolerance.
 */
let offsetMs = 0
let samples = 0

/** Record a server timestamp (ISO) seen at `receivedAtMs` (local clock). Smoothed after the first. */
export function noteServerTime(iso: string, receivedAtMs: number = Date.now()): void {
  const serverMs = Date.parse(iso)
  if (!Number.isFinite(serverMs)) return
  const sample = serverMs - receivedAtMs
  offsetMs = samples === 0 ? sample : offsetMs * 0.7 + sample * 0.3
  samples += 1
}

/** The server's idea of "now", in ms since the epoch. */
export function syncedNow(): number {
  return Date.now() + offsetMs
}

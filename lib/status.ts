import type { ScreenPresence, ScreenStatusPayload, ScreenView } from '@/types/api'

/** A screen is online when its last heartbeat is within this window. */
export const ONLINE_WINDOW_MS = 75_000
export const HEARTBEAT_INTERVAL_MS = 30_000

function toMillis(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const ms = typeof value === 'string' ? new Date(value).getTime() : value.getTime()
  return Number.isNaN(ms) ? null : ms
}

export function isOnline(lastSeenAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  const seen = toMillis(lastSeenAt)
  if (seen === null) return false
  return now.getTime() - seen <= ONLINE_WINDOW_MS
}

/**
 * Merge a realtime status payload into a screen view: last_seen_at = max(screen, status);
 * current_item_id from the status when it is newer; online recomputed with isOnline.
 */
export function mergeScreenStatus(
  screen: ScreenView,
  status: ScreenStatusPayload | undefined,
  now: Date,
): ScreenView {
  if (!status || status.screen_id !== screen.id) {
    return { ...screen, online: isOnline(screen.last_seen_at, now) }
  }
  const screenMs = toMillis(screen.last_seen_at) ?? -Infinity
  const statusMs = toMillis(status.last_seen_at) ?? -Infinity
  const statusIsNewer = statusMs >= screenMs
  const last_seen_at = statusIsNewer ? status.last_seen_at : screen.last_seen_at
  const current_item_id = statusIsNewer ? status.current_item_id : screen.current_item_id
  return { ...screen, last_seen_at, current_item_id, online: isOnline(last_seen_at, now) }
}

/** !paired → 'unpaired'; else online ? 'online' : 'offline'. */
export function screenStatus(view: Pick<ScreenView, 'paired' | 'online'>): ScreenPresence {
  if (!view.paired) return 'unpaired'
  return view.online ? 'online' : 'offline'
}

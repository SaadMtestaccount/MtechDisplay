/**
 * lib/player/playback.ts — pure playback helpers for the engine (docs/CONTRACTS.md §10).
 * Active-list evaluation (schedule in the org timezone + expires_at), next-item selection
 * and per-item advance timing live here so PlaybackEngine stays thin React.
 */
import { isItemActive } from '@/lib/schedule'
import { DEFAULT_ITEM_DURATION_SECONDS, type Manifest, type ManifestItem } from '@/types/api'

/** ManifestItem.expires_at has passed (content plays through the end of its day, §5.11). */
export function isItemExpired(item: ManifestItem, now: Date): boolean {
  if (item.expires_at === null) return false
  const at = new Date(item.expires_at).getTime()
  return Number.isFinite(at) && at <= now.getTime()
}

/** Items currently allowed to play: schedule active in the screen's timezone, not expired. */
export function activeItems(manifest: Manifest, now: Date): ManifestItem[] {
  return manifest.items.filter(
    (item) => isItemActive(item.schedule, now, manifest.screen.timezone) && !isItemExpired(item, now),
  )
}

/**
 * The next playable item after `currentId` in loop order (starting at the top when the
 * current item is gone). Returns the current item itself when it is the only playable
 * one (a single-item playlist repeats), or null when nothing is playable → standby.
 */
export function nextPlayable(
  items: ManifestItem[],
  currentId: string | null,
  canPlay: (item: ManifestItem) => boolean,
): ManifestItem | null {
  if (items.length === 0) return null
  const start = currentId === null ? -1 : items.findIndex((item) => item.id === currentId)
  for (let step = 1; step <= items.length; step++) {
    const item = items[((start + step) % items.length + items.length) % items.length]
    if (item && canPlay(item)) return item
  }
  return null
}

/**
 * How long the engine lets an item run before advancing: images/websites exactly
 * `duration_seconds`; videos get a `duration_seconds + 1s` safety timer — `ended`
 * normally advances first, and an override shorter than the file cuts early (§10).
 */
export function advanceDelayMs(item: ManifestItem): number {
  const seconds =
    Number.isFinite(item.duration_seconds) && item.duration_seconds > 0
      ? item.duration_seconds
      : DEFAULT_ITEM_DURATION_SECONDS
  return item.type === 'video' ? (seconds + 1) * 1000 : seconds * 1000
}

/** Light shape check for a manifest read back from localStorage. */
export function isManifest(v: unknown): v is Manifest {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Record<string, unknown>
  const screen = m.screen as Record<string, unknown> | null | undefined
  return (
    typeof screen === 'object' &&
    screen !== null &&
    typeof screen.id === 'string' &&
    typeof screen.timezone === 'string' &&
    typeof m.playlist_version === 'number' &&
    typeof m.generated_at === 'string' &&
    Array.isArray(m.items) &&
    typeof m.org === 'object' &&
    m.org !== null
  )
}

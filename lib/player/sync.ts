/**
 * lib/player/sync.ts — pure helpers for synchronized playback (docs/CONTRACTS.md §21). The active
 * list is laid out as consecutive slots (one per item, its duration) that repeat forever from the
 * starting line (`epochMs`: when sync was turned on — so pressing Sync starts everyone from 0:00
 * together; the Unix epoch when unknown). Any TV with the same list, the same starting line and a
 * server-aligned clock lands on the same slot at the same offset — no coordination needed.
 */
import { DEFAULT_ITEM_DURATION_SECONDS, type ManifestItem } from '@/types/api'

export type Slot = {
  item: ManifestItem
  index: number
  /** synced wall-clock ms when this slot began — MediaLayer seeks videos to (now − startMs) */
  startMs: number
  offsetMs: number
  remainingMs: number
}

/** A slot is at least 1 s so a bad duration can't spin the engine. */
export function slotLengthMs(item: ManifestItem): number {
  const seconds =
    Number.isFinite(item.duration_seconds) && item.duration_seconds > 0
      ? item.duration_seconds
      : DEFAULT_ITEM_DURATION_SECONDS
  return Math.max(1000, Math.round(seconds * 1000))
}

/** ISO starting line → ms; 0 (the Unix epoch) when absent or unparsable. */
export function epochMsOf(iso: string | null | undefined): number {
  if (!iso) return 0
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

/** The slot the shared clock points at right now; null for an empty list. */
export function slotAt(items: ManifestItem[], nowMs: number, epochMs: number = 0): Slot | null {
  if (items.length === 0) return null
  const lengths = items.map(slotLengthMs)
  const total = lengths.reduce((sum, ms) => sum + ms, 0)
  const elapsed = nowMs - epochMs
  const phase = ((elapsed % total) + total) % total
  let cursor = 0
  for (let index = 0; index < items.length; index++) {
    const length = lengths[index] ?? 1000
    const item = items[index]
    if (item && phase < cursor + length) {
      const offsetMs = phase - cursor
      return { item, index, startMs: nowMs - offsetMs, offsetMs, remainingMs: length - offsetMs }
    }
    cursor += length
  }
  return null
}

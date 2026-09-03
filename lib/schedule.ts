/**
 * lib/schedule.ts — pure, isomorphic schedule evaluation (player + editor).
 * Every function takes a `ManifestSchedule`; playlist_items rows satisfy it structurally.
 * Zone math uses Intl.DateTimeFormat only (no date libraries), invalid zones fall back to UTC.
 */
import type { ManifestSchedule } from '@/types/api'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MINUTES_PER_DAY = 24 * 60

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number }

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return 'UTC'
  }
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const zone = safeZone(timeZone)
  const cached = formatterCache.get(zone)
  if (cached) return cached
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  })
  formatterCache.set(zone, fmt)
  return fmt
}

function partsIn(at: Date, timeZone: string): Parts {
  const out: Parts = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, weekday: 0 }
  for (const part of formatterFor(timeZone).formatToParts(at)) {
    switch (part.type) {
      case 'year': out.year = Number(part.value); break
      case 'month': out.month = Number(part.value); break
      case 'day': out.day = Number(part.value); break
      case 'hour': out.hour = Number(part.value) % 24; break // some engines emit "24" at midnight
      case 'minute': out.minute = Number(part.value); break
      case 'second': out.second = Number(part.value); break
      case 'weekday': {
        const idx = DAY_NAMES.findIndex((d) => part.value.startsWith(d))
        out.weekday = idx >= 0 ? idx : 0
        break
      }
      default: break
    }
  }
  return out
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Parses 'HH:MM' or 'HH:MM:SS' into minutes since midnight; null when unparseable. */
function parseTimeMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 24 || mi > 59) return null
  return h * 60 + mi
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${pad2(h)}:${pad2(m)}`
}

export function hasSchedule(s: ManifestSchedule): boolean {
  return (
    s.active_from !== null ||
    s.active_to !== null ||
    (Array.isArray(s.days_of_week) && s.days_of_week.length > 0) ||
    s.daily_start !== null ||
    s.daily_end !== null
  )
}

export function zonedParts(now: Date, timeZone: string): { date: string; minutes: number; weekday: number } {
  const p = partsIn(now, timeZone)
  return {
    date: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
    minutes: p.hour * 60 + p.minute,
    weekday: p.weekday,
  }
}

/** UTC offset of the zone at that instant in ms (e.g. -14_400_000 for EDT). */
export function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = partsIn(at, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const wholeSeconds = Math.floor(at.getTime() / 1000) * 1000
  return asUtc - wholeSeconds
}

/** ISO instant of 23:59:59.999 of calendar day 'YYYY-MM-DD' in the zone. */
export function endOfDayInZone(date: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, (m || 1) - 1, d || 1, 23, 59, 59, 999)
  const firstOffset = zoneOffsetMs(new Date(guess), timeZone)
  let result = guess - firstOffset
  const secondOffset = zoneOffsetMs(new Date(result), timeZone)
  if (secondOffset !== firstOffset) result = guess - secondOffset
  return new Date(result).toISOString()
}

/** 'YYYY-MM-DD' of that instant in the zone. */
export function dateInZone(iso: string | Date, timeZone: string): string {
  const at = typeof iso === 'string' ? new Date(iso) : iso
  return zonedParts(at, timeZone).date
}

export function isItemActive(s: ManifestSchedule, now: Date, timeZone: string): boolean {
  const { date, minutes, weekday } = zonedParts(now, timeZone)

  if (s.active_from && date < s.active_from.slice(0, 10)) return false
  if (s.active_to && date > s.active_to.slice(0, 10)) return false

  if (Array.isArray(s.days_of_week) && s.days_of_week.length > 0 && !s.days_of_week.includes(weekday)) {
    return false
  }

  const startRaw = parseTimeMinutes(s.daily_start)
  const endRaw = parseTimeMinutes(s.daily_end)
  if (startRaw === null && endRaw === null) return true
  const start = startRaw ?? 0
  const end = endRaw ?? MINUTES_PER_DAY
  if (start === end) return true
  if (start < end) return minutes >= start && minutes < end
  // overnight window, e.g. 22:00 → 06:00
  return minutes >= start || minutes < end
}

function describeDays(days: number[]): string {
  const uniq = Array.from(new Set(days.filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b)
  if (uniq.length === 0 || uniq.length === 7) return ''
  const runs: string[] = []
  let i = 0
  while (i < uniq.length) {
    let j = i
    while (j + 1 < uniq.length && uniq[j + 1] === uniq[j] + 1) j++
    if (j - i >= 2) runs.push(`${DAY_NAMES[uniq[i]]}–${DAY_NAMES[uniq[j]]}`)
    else for (let k = i; k <= j; k++) runs.push(DAY_NAMES[uniq[k]])
    i = j + 1
  }
  return runs.join(', ')
}

/** 'Always' | e.g. 'Mon–Fri · 09:00–17:00 · 2026-09-01 → 2026-09-30' */
export function describeSchedule(s: ManifestSchedule): string {
  if (!hasSchedule(s)) return 'Always'
  const parts: string[] = []

  if (Array.isArray(s.days_of_week) && s.days_of_week.length > 0) {
    const days = describeDays(s.days_of_week)
    if (days) parts.push(days)
  }

  const start = parseTimeMinutes(s.daily_start)
  const end = parseTimeMinutes(s.daily_end)
  if (start !== null || end !== null) {
    parts.push(`${formatMinutes(start ?? 0)}–${formatMinutes(end ?? MINUTES_PER_DAY)}`)
  }

  if (s.active_from || s.active_to) {
    const from = s.active_from ? s.active_from.slice(0, 10) : ''
    const to = s.active_to ? s.active_to.slice(0, 10) : ''
    parts.push(`${from} → ${to}`.trim())
  }

  return parts.length > 0 ? parts.join(' · ') : 'Always'
}

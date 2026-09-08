import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceStrict, parse } from 'date-fns'
import { ORIENTATIONS, ROTATIONS, type Orientation, type Rotation } from '@/types/api'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** '1.2 MB' */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1)
  const value = bytes / 1024 ** exp
  const rounded = exp === 0 ? String(Math.round(value)) : value.toFixed(value >= 100 ? 0 : 1)
  return `${rounded} ${BYTE_UNITS[exp]}`
}

/** '0:05', '1:03:20'; '' for null/undefined. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return ''
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 'just now', '3 minutes ago'; 'never' for null/undefined or invalid dates. */
export function relativeTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (value === null || value === undefined) return 'never'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return 'never'
  if (Math.abs(now.getTime() - date.getTime()) < 10_000) return 'just now'
  return formatDistanceStrict(date, now, { addSuffix: true })
}

/** 'JD' for 'Jane Doe', 'A' for 'alice@example.com'. */
export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] ?? '' : nameOrEmail
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase()
  return `${parts[0]?.charAt(0) ?? ''}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase()
}

export function isRotation(n: number): n is Rotation {
  return (ROTATIONS as readonly number[]).includes(n)
}

export function isOrientation(s: string): s is Orientation {
  return (ORIENTATIONS as readonly string[]).includes(s)
}

/** lowercase, a-z0-9 and '-', trimmed, max 60. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/** Escapes % _ \ for PostgREST ilike patterns. */
export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** LOCAL calendar day as 'yyyy-MM-dd' — never toISOString(). */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Local midnight of a 'yyyy-MM-dd' day. */
export function fromDateString(value: string): Date {
  return parse(value, 'yyyy-MM-dd', new Date())
}

/** 'K7QP2M9X' → 'K7QP-2M9X' for display; '' for empty. */
export function formatLoginCode(code: string | null | undefined): string {
  if (!code) return ''
  const raw = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
}

/** Google favicon service URL for the site's host; '' when the url does not parse. */
export function faviconUrl(url: string): string {
  try {
    const host = new URL(url).host
    return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : ''
  } catch {
    return ''
  }
}

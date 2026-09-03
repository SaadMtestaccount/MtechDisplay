/**
 * lib/channels.ts — ISOMORPHIC, pure. Channel names, the shared private-channel config, and the
 * payload guards every broadcast consumer (server and browser) narrows `unknown` payloads with.
 * See docs/CONTRACTS.md §5.8 and §7.
 */
import {
  CHANGED_TABLES,
  type ChangedTable,
  type OrgChangedPayload,
  type ScreenCommandPayload,
  type ScreenStatusPayload,
} from '@/types/api'

export function screenChannel(screenId: string): string {
  return `screen-${screenId}`
}

export function orgChannel(orgId: string): string {
  return `org-${orgId}`
}

/** Pass to every `.channel(name, CHANNEL_CONFIG)` call, server and browser (decision §0.2). */
export const CHANNEL_CONFIG = { config: { private: true } } as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isChangedTable(v: unknown): v is ChangedTable {
  return typeof v === 'string' && (CHANGED_TABLES as readonly string[]).includes(v)
}

export function isScreenStatusPayload(v: unknown): v is ScreenStatusPayload {
  if (!isRecord(v)) return false
  return (
    typeof v.screen_id === 'string' &&
    typeof v.last_seen_at === 'string' &&
    (typeof v.current_item_id === 'string' || v.current_item_id === null) &&
    v.online === true
  )
}

export function isOrgChangedPayload(v: unknown): v is OrgChangedPayload {
  if (!isRecord(v)) return false
  return (
    isChangedTable(v.table) &&
    (typeof v.id === 'string' || v.id === undefined) &&
    typeof v.at === 'string'
  )
}

export function isScreenCommandPayload(v: unknown): v is ScreenCommandPayload {
  return isRecord(v) && typeof v.at === 'string'
}

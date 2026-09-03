/**
 * lib/events.ts ★ — append-only audit log (docs/CONTRACTS.md §5.9). Server-only.
 * Inserts never throw: an audit failure must not fail the mutation it describes.
 */
import type { DbClient, EventType, Json } from '@/types/db'

export type LogEventInput = { org_id: string; screen_id?: string | null; type: EventType; payload?: Json }

const STATUS_EVENT_TYPES: EventType[] = ['screen_online', 'screen_offline', 'screen_paired']

export async function logEvent(client: DbClient, input: LogEventInput): Promise<void> {
  try {
    const { error } = await client.from('events').insert({
      org_id: input.org_id,
      screen_id: input.screen_id ?? null,
      type: input.type,
      payload: input.payload ?? {},
    })
    if (error) console.error('[events] insert failed', input.type, error.message)
  } catch (e) {
    console.error('[events] insert threw', input.type, e)
  }
}

/** Latest status event (screen_online / screen_offline / screen_paired) for a screen, or null. */
export async function lastScreenStatusEvent(admin: DbClient, screenId: string): Promise<EventType | null> {
  const { data, error } = await admin
    .from('events')
    .select('type')
    .eq('screen_id', screenId)
    .in('type', STATUS_EVENT_TYPES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[events] lastScreenStatusEvent failed', screenId, error.message)
    return null
  }
  return data?.type ?? null
}

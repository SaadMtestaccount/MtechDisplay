/**
 * lib/broadcast.ts — SERVER ONLY (service role). Publishes Realtime broadcasts over REST
 * (`channel.httpSend`, decision §0.1); never subscribes, never throws. Every caller awaits it.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { CHANNEL_CONFIG, orgChannel, screenChannel } from '@/lib/channels'
import type {
  ChangedTable, OrgChangedPayload, ScreenCommandEvent, ScreenCommandPayload, ScreenStatusPayload,
} from '@/types/api'

export async function broadcast(channel: string, event: string, payload: object): Promise<void> {
  const admin = createAdminClient()
  const ch = admin.channel(channel, CHANNEL_CONFIG)
  try {
    const result = await ch.httpSend(event, payload)
    if (!result.success) console.error('[broadcast]', channel, event, result)
  } catch (e) {
    if (String(e).includes('v2.97.0')) {
      // legacy REST batch endpoint on an older local Realtime stack
      try {
        await ch.send({ type: 'broadcast', event, payload })
      } catch (legacyError) {
        console.error('[broadcast:legacy]', channel, event, legacyError)
      }
    } else {
      console.error('[broadcast]', channel, event, e)
    }
  } finally {
    try {
      await admin.removeChannel(ch)
    } catch {
      // nothing to tear down
    }
  }
}

export async function broadcastToScreens(
  screenIds: string[],
  event: ScreenCommandEvent,
  payload?: ScreenCommandPayload,
): Promise<void> {
  const body: ScreenCommandPayload = payload ?? { at: new Date().toISOString() }
  for (const id of Array.from(new Set(screenIds))) {
    await broadcast(screenChannel(id), event, body)
  }
}

export async function notifyOrgChanged(orgId: string, table: ChangedTable, id?: string): Promise<void> {
  const payload: OrgChangedPayload = { table, at: new Date().toISOString() }
  if (id !== undefined) payload.id = id
  await broadcast(orgChannel(orgId), 'changed', payload)
}

export async function broadcastScreenStatus(orgId: string, payload: ScreenStatusPayload): Promise<void> {
  await broadcast(orgChannel(orgId), 'status', payload)
}

/**
 * lib/heartbeat.ts — SERVER ONLY. Records a device heartbeat (docs/CONTRACTS.md §5.24):
 * updates presence columns, verifies the reported current item against the effective playlist
 * (decision §0.7), writes retroactive offline/online events (decision §0.5) and broadcasts
 * `status`. A heartbeat never fails because of the device's data.
 */
import { broadcastScreenStatus } from '@/lib/broadcast'
import { getRequestIp } from '@/lib/device-auth'
import { lastScreenStatusEvent, logEvent } from '@/lib/events'
import { getEffectivePlaylistId } from '@/lib/playlists'
import { isOnline } from '@/lib/status'
import type { HeartbeatRequest, HeartbeatResponse } from '@/types/api'
import type { DbClient, Screen } from '@/types/db'

const USER_AGENT_MAX_CHARS = 500

/** null unless the reported item exists in the screen's effective playlist; any lookup error → null. */
async function resolveCurrentItemId(
  admin: DbClient,
  screen: Screen,
  reportedItemId: string | null,
): Promise<string | null> {
  if (reportedItemId === null) return null
  try {
    const effective = await getEffectivePlaylistId(admin, screen)
    if (effective === null) return null
    const { data, error } = await admin
      .from('playlist_items')
      .select('id')
      .eq('id', reportedItemId)
      .eq('playlist_id', effective)
      .maybeSingle()
    if (error) {
      console.error('[heartbeat] current item lookup failed', reportedItemId, error.message)
      return null
    }
    return data?.id ?? null
  } catch (e) {
    console.error('[heartbeat] effective playlist lookup failed', screen.id, e)
    return null
  }
}

export async function recordHeartbeat(
  admin: DbClient,
  screen: Screen,
  input: HeartbeatRequest,
  request: Request,
  now: Date = new Date(),
): Promise<HeartbeatResponse> {
  const nowIso = now.toISOString()
  const wasOnline = isOnline(screen.last_seen_at, now)

  const currentItemId = await resolveCurrentItemId(admin, screen, input.current_item_id)

  const userAgent = request.headers.get('user-agent')
  const runUpdate = (current_item_id: string | null) =>
    admin
      .from('screens')
      .update({
        last_seen_at: nowIso,
        last_ip: getRequestIp(request),
        user_agent: userAgent ? userAgent.slice(0, USER_AGENT_MAX_CHARS) : null,
        resolution: input.resolution ?? screen.resolution,
        current_item_id,
      })
      .eq('id', screen.id)
      .select('playlist_version')
      .single()

  let storedItemId = currentItemId
  let result = await runUpdate(currentItemId)
  if (result.error && result.error.code === '23503') {
    // The item was deleted between the lookup and the update — retry once without it.
    storedItemId = null
    result = await runUpdate(null)
  }
  if (result.error) throw result.error
  const { playlist_version } = result.data

  // Best-effort status events; a failure here never fails the heartbeat.
  if (!wasOnline) {
    try {
      if (screen.last_seen_at !== null && (await lastScreenStatusEvent(admin, screen.id)) !== 'screen_offline') {
        // The screen returned after a gap the cron did not observe — log the offline retroactively (§0.5).
        await logEvent(admin, {
          org_id: screen.org_id,
          screen_id: screen.id,
          type: 'screen_offline',
          payload: { last_seen_at: screen.last_seen_at },
        })
      }
      await logEvent(admin, {
        org_id: screen.org_id,
        screen_id: screen.id,
        type: 'screen_online',
        payload: { last_seen_at: nowIso },
      })
    } catch (e) {
      console.error('[heartbeat] status events failed', screen.id, e)
    }
  }

  // Best effort by construction (broadcast never throws) — still awaited (§5 conventions).
  await broadcastScreenStatus(screen.org_id, {
    screen_id: screen.id,
    last_seen_at: nowIso,
    current_item_id: storedItemId,
    online: true,
  })

  return { playlist_version }
}

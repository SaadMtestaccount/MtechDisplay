/**
 * lib/cron.ts — SERVER ONLY. The only reader of CRON_SECRET. Tick logic for /api/cron/tick:
 * offline/online events for screens that stay down, playlists touched by content expiry,
 * expired pairing-code cleanup (docs/CONTRACTS.md §5.26).
 */
import { timingSafeEqual } from 'node:crypto'
import { ApiError } from '@/lib/api'
import { lastScreenStatusEvent, logEvent } from '@/lib/events'
import { touchPlaylist } from '@/lib/playlists'
import { isOnline } from '@/lib/status'
import type { CronTickResponse } from '@/types/api'
import type { DbClient } from '@/types/db'

const EXPIRY_WINDOW_MS = 10 * 60_000

/** Fails closed: unset secret → 500; wrong/missing bearer → 401. */
export function requireCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new ApiError(500, 'CRON_SECRET is not configured')
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const provided = match?.[1]?.trim() ?? ''
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(secret, 'utf8')
  if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError(401, 'Unauthorized')
  }
}

async function reconcileScreenEvents(admin: DbClient, now: Date): Promise<Pick<CronTickResponse, 'screens_checked' | 'went_offline' | 'came_online'>> {
  const { data: screens, error } = await admin
    .from('screens')
    .select('id, org_id, last_seen_at')
    .not('last_seen_at', 'is', null)
  if (error) throw error

  let wentOffline = 0
  let cameOnline = 0
  for (const screen of screens) {
    const online = isOnline(screen.last_seen_at, now)
    const last = await lastScreenStatusEvent(admin, screen.id)
    if (!online && (last === 'screen_online' || last === 'screen_paired')) {
      await logEvent(admin, {
        org_id: screen.org_id,
        screen_id: screen.id,
        type: 'screen_offline',
        payload: { last_seen_at: screen.last_seen_at },
      })
      wentOffline++
    } else if (online && last === 'screen_offline') {
      await logEvent(admin, {
        org_id: screen.org_id,
        screen_id: screen.id,
        type: 'screen_online',
        payload: { last_seen_at: screen.last_seen_at },
      })
      cameOnline++
    }
  }
  return { screens_checked: screens.length, went_offline: wentOffline, came_online: cameOnline }
}

/** Playlists containing content that expired inside (now − 10 min, now]. */
async function touchExpiredPlaylists(admin: DbClient, now: Date): Promise<number> {
  const { data, error } = await admin
    .from('playlist_items')
    .select('playlist_id, content!inner(expires_at)')
    .gt('content.expires_at', new Date(now.getTime() - EXPIRY_WINDOW_MS).toISOString())
    .lte('content.expires_at', now.toISOString())
  if (error) throw error
  const playlistIds = Array.from(new Set(data.map((row) => row.playlist_id)))
  for (const id of playlistIds) await touchPlaylist(admin, id)
  return playlistIds.length
}

async function deleteExpiredCodes(admin: DbClient, now: Date): Promise<number> {
  const { data, error } = await admin.from('pairing_codes').delete().lt('expires_at', now.toISOString()).select('id')
  if (error) throw error
  return data.length
}

export async function runCronTick(admin: DbClient, now: Date = new Date()): Promise<CronTickResponse> {
  const status = await reconcileScreenEvents(admin, now)
  const playlists_touched = await touchExpiredPlaylists(admin, now)
  const codes_deleted = await deleteExpiredCodes(admin, now)
  return { ...status, playlists_touched, codes_deleted }
}

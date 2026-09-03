/**
 * lib/screens/self-claim.ts — SERVER ONLY. Merchant TV provisioning (CONTRACTS addendum §13):
 * a signed-in org member mints a device token for their own org — no pairing code, no admin
 * claim. Same-fingerprint devices reuse their screen row (token rotates); first claim creates
 * screen + playlist and seeds the playlist with the org's current media so pre-uploaded
 * content plays immediately after login. Returns the raw token exactly once (§0.13 rule).
 */
import { ApiError } from '@/lib/api'
import { notifyOrgChanged } from '@/lib/broadcast'
import { logEvent } from '@/lib/events'
import { generateDeviceToken, hashDeviceToken } from '@/lib/pairing'
import { createPlaylist, deletePlaylist, touchPlaylist } from '@/lib/playlists'
import type { PlayerDeviceState } from '@/types/api'
import type { DbClient } from '@/types/db'

async function resolveOrg(admin: DbClient, userId: string): Promise<{ id: string; name: string }> {
  const { data: membership, error } = await admin
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!membership) throw new ApiError(403, 'No organization assigned to this account. Please contact MTech.')

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', membership.org_id)
    .single()
  if (orgError) throw orgError
  return org
}

/** Fills the new screen's playlist with the org's non-expired media, oldest first. */
async function seedPlaylist(admin: DbClient, orgId: string, playlistId: string, nowIso: string): Promise<number> {
  const { data: content, error } = await admin
    .from('content')
    .select('id')
    .eq('org_id', orgId)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (content ?? []).map((c, i) => ({
    playlist_id: playlistId,
    position: i,
    item_type: 'content' as const,
    content_id: c.id,
  }))
  if (rows.length === 0) return 0
  const { error: insertError } = await admin.from('playlist_items').insert(rows)
  if (insertError) throw insertError
  return rows.length
}

export async function selfClaimScreen(
  admin: DbClient,
  userId: string,
  fingerprint: string,
): Promise<PlayerDeviceState> {
  const org = await resolveOrg(admin, userId)
  const now = new Date()
  const nowIso = now.toISOString()
  const token = generateDeviceToken()
  const tokenHash = hashDeviceToken(token)

  // Same device again → rotate the token on its existing screen.
  const { data: existing, error: existingError } = await admin
    .from('screens')
    .select('id')
    .eq('org_id', org.id)
    .eq('fingerprint', fingerprint)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) {
    const { error } = await admin
      .from('screens')
      .update({ device_token_hash: tokenHash, paired_at: nowIso })
      .eq('id', existing.id)
    if (error) throw error
    await notifyOrgChanged(org.id, 'screens', existing.id)
    return { device_token: token, screen_id: existing.id }
  }

  // First claim from this device: screen + playlist, seeded from the org library.
  const { count, error: countError } = await admin
    .from('screens')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)
  if (countError) throw countError
  const name = `${org.name} TV ${(count ?? 0) + 1}`

  const playlist = await createPlaylist(admin, org.id, name, 'screen')
  const { data: screen, error: screenError } = await admin
    .from('screens')
    .insert({
      org_id: org.id,
      name,
      playlist_id: playlist.id,
      device_token_hash: tokenHash,
      fingerprint,
      paired_at: nowIso,
    })
    .select('id')
    .single()
  if (screenError) {
    await deletePlaylist(admin, playlist.id).catch((e: unknown) => console.error('[self-claim] cleanup', e))
    throw screenError
  }

  const seeded = await seedPlaylist(admin, org.id, playlist.id, nowIso)
  if (seeded > 0) await touchPlaylist(admin, playlist.id)

  await logEvent(admin, {
    org_id: org.id,
    screen_id: screen.id,
    type: 'screen_paired',
    payload: { name, self_claimed: true, seeded_items: seeded },
  })
  await notifyOrgChanged(org.id, 'screens', screen.id)
  return { device_token: token, screen_id: screen.id }
}

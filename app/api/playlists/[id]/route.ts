/**
 * /api/playlists/[id] — GET one playlist with its items ordered by position (PlaylistView; 404
 * outside the active org); PATCH rename / synchronized playback (§21). docs/CONTRACTS.md §6.1, §5.18.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { getPlaylistView, updatePlaylist } from '@/lib/playlists'
import { createAdminClient } from '@/lib/supabase/admin'
import { playlistUpdateSchema } from '@/lib/validators/playlists'

export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  return ok(await getPlaylistView(ctxOrg.supabase, ctxOrg.org.id, id))
})

export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, playlistUpdateSchema)
  return ok(await updatePlaylist(ctxOrg, createAdminClient(), id, input))
})

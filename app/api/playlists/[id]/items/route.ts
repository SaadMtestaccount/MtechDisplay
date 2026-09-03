/**
 * /api/playlists/[id]/items — PUT the full ordered item list (savePlaylistItemsSchema →
 * PlaylistView). Bumps versions + broadcasts `sync` via touchPlaylist inside
 * savePlaylistItems. docs/CONTRACTS.md §6.1, §5.18.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { savePlaylistItems } from '@/lib/playlists'
import { createAdminClient } from '@/lib/supabase/admin'
import { savePlaylistItemsSchema } from '@/lib/validators/playlists'

export const PUT = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, savePlaylistItemsSchema)
  return ok(await savePlaylistItems(ctxOrg, createAdminClient(), id, input.items))
})

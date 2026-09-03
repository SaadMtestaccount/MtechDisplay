/**
 * /api/playlists/[id] — GET one playlist with its items ordered by position
 * (PlaylistView; 404 outside the active org). docs/CONTRACTS.md §6.1, §5.18.
 */
import { ok, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { getPlaylistView } from '@/lib/playlists'

export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  return ok(await getPlaylistView(ctxOrg.supabase, ctxOrg.org.id, id))
})

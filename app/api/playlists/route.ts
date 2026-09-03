/**
 * /api/playlists — GET the active org's playlists, optionally filtered by kind
 * (playlistListQuerySchema → Playlist[]). docs/CONTRACTS.md §6.1, §5.18.
 */
import { ok, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { listPlaylists } from '@/lib/playlists'
import { playlistListQuerySchema } from '@/lib/validators/playlists'

export const GET = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const query = parseQuery(request, playlistListQuerySchema)
  return ok(await listPlaylists(ctx.supabase, ctx.org.id, query))
})

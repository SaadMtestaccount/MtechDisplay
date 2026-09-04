/** /api/menus/[id] — one menu. Boards are edited through PUT /api/playlists/[id]/items. */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { deleteMenu, getMenu, renameMenu } from '@/lib/menus'
import { createAdminClient } from '@/lib/supabase/admin'
import { menuInputSchema } from '@/lib/validators/menus'
import type { OkResponse } from '@/types/api'

/** GET /api/menus/[id] — PlaylistView (the menu with its ordered boards). */
export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const org = await requireOrgContext()
  return ok(await getMenu(org.supabase, org.org.id, id))
})

/** PATCH /api/menus/[id] — rename → Playlist. */
export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const org = await requireOrgContext()
  const input = await parseBody(request, menuInputSchema)
  return ok(await renameMenu(org, id, input.name))
})

/** DELETE /api/menus/[id] — delete the menu; screens showing it fall back and re-sync. */
export const DELETE = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const org = await requireOrgContext()
  await deleteMenu(org, createAdminClient(), id)
  return ok<OkResponse>({ ok: true })
})

/** /api/menus — reusable menus (kind='menu' playlists). Org-scoped (docs/CONTRACTS.md §14). */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { createMenu, listMenus } from '@/lib/menus'
import { menuInputSchema } from '@/lib/validators/menus'

/** GET /api/menus — MenuView[] for the active org. */
export const GET = withHandler(async () => {
  const ctx = await requireOrgContext()
  return ok(await listMenus(ctx.supabase, ctx.org.id))
})

/** POST /api/menus — create an empty menu → Playlist (201). */
export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const input = await parseBody(request, menuInputSchema)
  return ok(await createMenu(ctx, input.name), { status: 201 })
})

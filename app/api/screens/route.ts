import { ok, parseBody, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { createScreen, listScreens } from '@/lib/screens'
import { createScreenSchema, screenListQuerySchema } from '@/lib/validators/screens'

/** GET /api/screens — ScreenView[] for the active org (docs/CONTRACTS.md §6.1). */
export const GET = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const query = parseQuery(request, screenListQuerySchema)
  return ok(await listScreens(ctx.supabase, ctx.org.id, query))
})

/** POST /api/screens — add a TV: a bare screen with its own login code → ScreenView (201). */
export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const input = await parseBody(request, createScreenSchema)
  return ok(await createScreen(ctx, input.name), { status: 201 })
})

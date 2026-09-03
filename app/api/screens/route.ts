import { ok, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { listScreens } from '@/lib/screens'
import { screenListQuerySchema } from '@/lib/validators/screens'

/** GET /api/screens — ScreenView[] for the active org (docs/CONTRACTS.md §6.1). */
export const GET = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const query = parseQuery(request, screenListQuerySchema)
  return ok(await listScreens(ctx.supabase, ctx.org.id, query))
})

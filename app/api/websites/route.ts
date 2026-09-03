import { ok, parseBody, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { websiteInputSchema, websiteListQuerySchema } from '@/lib/validators/websites'
import { createWebsite, listWebsites } from '@/lib/websites'

/** GET /api/websites — the active org's websites (docs/CONTRACTS.md §6.1). */
export const GET = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const query = parseQuery(request, websiteListQuerySchema)
  return ok(await listWebsites(ctx.supabase, ctx.org.id, query))
})

/** POST /api/websites — add a website. */
export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const input = await parseBody(request, websiteInputSchema)
  return ok(await createWebsite(ctx, input), { status: 201 })
})

import { ok, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { getWebsiteUsage } from '@/lib/websites'

/** GET /api/websites/[id]/usage — screens/groups whose effective playlist uses the site (§6.1). */
export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  return ok(await getWebsiteUsage(ctxOrg.supabase, ctxOrg.org.id, id))
})

/**
 * /api/groups/[id]/screens — PUT the full member set (groupScreensSchema →
 * GroupDetailView via setGroupScreens). docs/CONTRACTS.md §6.1, §5.20.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { setGroupScreens } from '@/lib/groups'
import { createAdminClient } from '@/lib/supabase/admin'
import { groupScreensSchema } from '@/lib/validators/groups'

export const PUT = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, groupScreensSchema)
  return ok(await setGroupScreens(ctxOrg, createAdminClient(), id, input.screen_ids))
})

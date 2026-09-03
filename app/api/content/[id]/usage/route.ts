/**
 * /api/content/[id]/usage — GET screens (by effective playlist) and groups whose playlist
 * contains the item. docs/CONTRACTS.md §6.1.
 */
import { ApiError, ok, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { getContentUsage } from '@/lib/content'
import { uuidSchema } from '@/lib/validators/common'

export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const parsed = uuidSchema.safeParse((await ctx.params).id)
  if (!parsed.success) throw new ApiError(404, 'Content not found')
  const ctxOrg = await requireOrgContext()
  return ok(await getContentUsage(ctxOrg.supabase, ctxOrg.org.id, parsed.data))
})

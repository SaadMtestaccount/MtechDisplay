import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { deleteScreen, getScreenDetail, updateScreen } from '@/lib/screens'
import { createAdminClient } from '@/lib/supabase/admin'
import { screenUpdateSchema } from '@/lib/validators/screens'
import type { OkResponse } from '@/types/api'

/** GET /api/screens/[id] — ScreenDetailView (effective playlist + group). */
export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  return ok(await getScreenDetail(ctxOrg.supabase, ctxOrg.org.id, id))
})

/** PATCH /api/screens/[id] — rename / rotation / group → ScreenView. */
export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, screenUpdateSchema)
  return ok(await updateScreen(ctxOrg, createAdminClient(), id, input))
})

/** DELETE /api/screens/[id] — revoke token, unpair, delete screen + its playlist. */
export const DELETE = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  await deleteScreen(ctxOrg, createAdminClient(), id)
  return ok<OkResponse>({ ok: true })
})

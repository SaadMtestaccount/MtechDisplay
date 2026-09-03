import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { sendScreenAction } from '@/lib/screens'
import { screenActionSchema } from '@/lib/validators/screens'
import type { OkResponse } from '@/types/api'

/** POST /api/screens/[id]/actions — broadcast `identify` / `reload` to the screen. */
export const POST = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, screenActionSchema)
  await sendScreenAction(ctxOrg, id, input.action)
  return ok<OkResponse>({ ok: true })
})

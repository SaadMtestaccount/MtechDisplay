import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { websiteInputSchema } from '@/lib/validators/websites'
import { deleteWebsite, getWebsite, updateWebsite } from '@/lib/websites'
import type { OkResponse } from '@/types/api'

/** GET /api/websites/[id] — one website of the active org (docs/CONTRACTS.md §6.1). */
export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  return ok(await getWebsite(ctxOrg.supabase, ctxOrg.org.id, id))
})

/** PATCH /api/websites/[id] — edit; url/refresh changes re-sync affected playlists (§5.17). */
export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, websiteInputSchema)
  return ok(await updateWebsite(ctxOrg, createAdminClient(), id, input))
})

/** DELETE /api/websites/[id] — playlist items cascade; affected playlists re-sync (§5.17). */
export const DELETE = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  await deleteWebsite(ctxOrg, createAdminClient(), id)
  return ok<OkResponse>({ ok: true })
})

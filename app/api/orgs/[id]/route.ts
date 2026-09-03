/**
 * /api/orgs/[id] — GET / PATCH / DELETE one organization. Auth: super
 * (docs/CONTRACTS.md §6.1). Deleting the active org is fine: the next layout
 * render falls back to the first visible org (§5.5).
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { deleteOrg, getOrgView, updateOrg } from '@/lib/organizations'
import { createAdminClient } from '@/lib/supabase/admin'
import { orgUpdateSchema } from '@/lib/validators/orgs'
import type { OkResponse } from '@/types/api'

export const GET = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const session = await requireSuperAdmin()
  return ok(await getOrgView(session.supabase, id))
})

export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const session = await requireSuperAdmin()
  const input = await parseBody(request, orgUpdateSchema)
  return ok(await updateOrg(session, createAdminClient(), id, input))
})

export const DELETE = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const session = await requireSuperAdmin()
  await deleteOrg(session, createAdminClient(), id)
  return ok<OkResponse>({ ok: true })
})

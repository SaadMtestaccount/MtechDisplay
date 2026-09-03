/**
 * /api/groups/[id] — GET detail (GroupDetailView), PATCH rename (groupInputSchema →
 * GroupView), DELETE (OkResponse; members revert to their own playlists).
 * docs/CONTRACTS.md §6.1, §5.20.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { deleteGroup, getGroupDetail, updateGroup } from '@/lib/groups'
import { createAdminClient } from '@/lib/supabase/admin'
import { groupInputSchema } from '@/lib/validators/groups'
import type { OkResponse } from '@/types/api'

export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  return ok(await getGroupDetail(ctxOrg.supabase, ctxOrg.org.id, id))
})

export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, groupInputSchema)
  return ok(await updateGroup(ctxOrg, id, input))
})

export const DELETE = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  await deleteGroup(ctxOrg, createAdminClient(), id)
  return ok<OkResponse>({ ok: true })
})

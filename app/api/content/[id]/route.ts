/**
 * /api/content/[id] — GET detail, PATCH rename/move/expiration, DELETE.
 * docs/CONTRACTS.md §6.1.
 */
import { ApiError, ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { deleteContent, getContent, updateContent } from '@/lib/content'
import { createAdminClient } from '@/lib/supabase/admin'
import { contentUpdateSchema } from '@/lib/validators/content'
import { uuidSchema } from '@/lib/validators/common'
import type { OkResponse } from '@/types/api'

function parseId(raw: string): string {
  const result = uuidSchema.safeParse(raw)
  if (!result.success) throw new ApiError(404, 'Content not found')
  return result.data
}

export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id)
  const ctxOrg = await requireOrgContext()
  return ok(await getContent(ctxOrg.supabase, ctxOrg.org.id, id))
})

export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const id = parseId((await ctx.params).id)
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, contentUpdateSchema)
  return ok(await updateContent(ctxOrg, createAdminClient(), id, input))
})

export const DELETE = withHandler<{ id: string }>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id)
  const ctxOrg = await requireOrgContext()
  await deleteContent(ctxOrg, createAdminClient(), id)
  return ok<OkResponse>({ ok: true })
})

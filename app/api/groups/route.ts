/**
 * /api/groups — GET list (groupListQuerySchema → GroupView[]), POST create
 * (groupInputSchema → GroupView 201). docs/CONTRACTS.md §6.1, §5.20.
 */
import { ok, parseBody, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { createGroup, listGroups } from '@/lib/groups'
import { groupInputSchema, groupListQuerySchema } from '@/lib/validators/groups'

export const GET = withHandler(async (request) => {
  const ctxOrg = await requireOrgContext()
  const query = parseQuery(request, groupListQuerySchema)
  return ok(await listGroups(ctxOrg.supabase, ctxOrg.org.id, query))
})

export const POST = withHandler(async (request) => {
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, groupInputSchema)
  return ok(await createGroup(ctxOrg, input), { status: 201 })
})

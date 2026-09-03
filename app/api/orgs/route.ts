/**
 * /api/orgs — GET (org views for every visible org; needs a session but no active org),
 * POST (create; super only). docs/CONTRACTS.md §6.1.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin, requireUser } from '@/lib/auth'
import { createOrg, listOrgViews } from '@/lib/organizations'
import { orgCreateSchema } from '@/lib/validators/orgs'

export const GET = withHandler(async () => {
  const session = await requireUser()
  return ok(await listOrgViews(session.supabase))
})

export const POST = withHandler(async (request) => {
  const session = await requireSuperAdmin()
  const input = await parseBody(request, orgCreateSchema)
  return ok(await createOrg(session, input), { status: 201 })
})

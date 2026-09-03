/**
 * POST /api/orgs/active — switch the active organization (super-admin org switcher).
 * Auth: requireUser (no active org needed). Validates the org is visible, answers
 * `{ org_id }` and sets the `msign_org` cookie on the response; the client then
 * calls router.refresh() (docs/CONTRACTS.md §5.5, §6.1, Appendix A).
 */
import { ApiError, ok, parseBody, withHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { listVisibleOrgs } from '@/lib/orgs'
import { activeOrgSchema } from '@/lib/validators/orgs'
import { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_OPTIONS, type ActiveOrgResponse } from '@/types/api'

export const POST = withHandler(async (request) => {
  const session = await requireUser()
  const { org_id } = await parseBody(request, activeOrgSchema)

  const orgs = await listVisibleOrgs(session.supabase)
  if (!orgs.some((org) => org.id === org_id)) throw new ApiError(404, 'Organization not found')

  const response = ok<ActiveOrgResponse>({ org_id })
  response.cookies.set(ACTIVE_ORG_COOKIE, org_id, ACTIVE_ORG_COOKIE_OPTIONS)
  return response
})

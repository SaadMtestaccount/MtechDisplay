/** POST /api/admin/screens/actions — { ids, action } across locations → { updated }. Super admin only (§23). */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { fleetAction } from '@/lib/screens/fleet'
import { createAdminClient } from '@/lib/supabase/admin'
import { fleetActionSchema } from '@/lib/validators/screens'

export const POST = withHandler(async (request) => {
  await requireSuperAdmin()
  const { ids, action } = await parseBody(request, fleetActionSchema)
  return ok(await fleetAction(createAdminClient(), ids, action))
})

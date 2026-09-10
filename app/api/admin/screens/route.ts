/** GET /api/admin/screens — every TV of every location (FleetScreenView[]). Super admin only (§23). */
import { ok, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { listAllScreens } from '@/lib/screens/fleet'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withHandler(async () => {
  await requireSuperAdmin()
  return ok(await listAllScreens(createAdminClient()))
})

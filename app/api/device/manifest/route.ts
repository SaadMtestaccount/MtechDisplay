/**
 * GET /api/device/manifest — device (Bearer token). The player's playlist snapshot
 * (docs/CONTRACTS.md §5.25, §6.3).
 */
import { ok, withHandler } from '@/lib/api'
import { authenticateDevice } from '@/lib/device-auth'
import { buildManifest } from '@/lib/manifest'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const GET = withHandler(async (request) => {
  const admin = createAdminClient()
  const screen = await authenticateDevice(request, admin)
  return ok(await buildManifest(admin, screen), { headers: { 'Cache-Control': 'no-store' } })
})

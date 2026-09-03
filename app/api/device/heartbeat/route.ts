/**
 * POST /api/device/heartbeat — device (Bearer token). Presence, current item and playlist
 * version check (docs/CONTRACTS.md §5.24, §6.2).
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { authenticateDevice } from '@/lib/device-auth'
import { recordHeartbeat } from '@/lib/heartbeat'
import { createAdminClient } from '@/lib/supabase/admin'
import { heartbeatSchema } from '@/lib/validators/device'

export const dynamic = 'force-dynamic'

export const POST = withHandler(async (request) => {
  const admin = createAdminClient()
  const screen = await authenticateDevice(request, admin)
  const input = await parseBody(request, heartbeatSchema)
  return ok(await recordHeartbeat(admin, screen, input, request), {
    headers: { 'Cache-Control': 'no-store' },
  })
})

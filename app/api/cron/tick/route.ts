/**
 * GET /api/cron/tick — cron secret. Offline/online reconciliation, playlists touched by content
 * expiry, expired pairing-code cleanup (docs/CONTRACTS.md §5.26, §6.2).
 */
import { ok, withHandler } from '@/lib/api'
import { requireCronSecret, runCronTick } from '@/lib/cron'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const GET = withHandler(async (request) => {
  requireCronSecret(request)
  return ok(await runCronTick(createAdminClient()), { headers: { 'Cache-Control': 'no-store' } })
})

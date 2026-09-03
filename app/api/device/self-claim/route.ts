/**
 * POST /api/device/self-claim — merchant TV provisioning (CONTRACTS addendum §13).
 * Under the public /api/device/ middleware prefix, so it enforces its own session auth:
 * any signed-in org member may claim a screen for their org. Body { fingerprint } →
 * { device_token, screen_id } (raw token returned exactly once).
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { selfClaimScreen } from '@/lib/screens/self-claim'
import { createAdminClient } from '@/lib/supabase/admin'
import { pairingCodeRequestSchema } from '@/lib/validators/device'

export const dynamic = 'force-dynamic'

export const POST = withHandler(async (request) => {
  const session = await requireUser()
  const input = await parseBody(request, pairingCodeRequestSchema)
  const state = await selfClaimScreen(createAdminClient(), session.user.id, input.fingerprint)
  return ok(state, { status: 201, headers: { 'Cache-Control': 'no-store' } })
})

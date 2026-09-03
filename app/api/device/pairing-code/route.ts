/**
 * POST /api/device/pairing-code — public. Mints a pairing code + device token; the raw token is
 * returned exactly once and only its hash is stored (docs/CONTRACTS.md §5.23, decision §0.13).
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { createPairingCode } from '@/lib/pairing'
import { createAdminClient } from '@/lib/supabase/admin'
import { pairingCodeRequestSchema } from '@/lib/validators/device'

export const dynamic = 'force-dynamic'

export const POST = withHandler(async (request) => {
  const input = await parseBody(request, pairingCodeRequestSchema)
  return ok(await createPairingCode(createAdminClient(), input.fingerprint), {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  })
})

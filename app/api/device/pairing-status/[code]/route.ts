/**
 * GET /api/device/pairing-status/[code]?fingerprint= — public poll (docs/CONTRACTS.md §5.23).
 * 404 whenever the code is unusable by this device (unknown, expired, other fingerprint).
 */
import { ok, parseQuery, withHandler } from '@/lib/api'
import { getPairingStatus } from '@/lib/pairing'
import { createAdminClient } from '@/lib/supabase/admin'
import { pairingCodeParamSchema, pairingStatusQuerySchema } from '@/lib/validators/device'

export const dynamic = 'force-dynamic'

export const GET = withHandler<{ code: string }>(async (request, ctx) => {
  const { code } = await ctx.params
  const parsedCode = pairingCodeParamSchema.parse(code) // malformed → ZodError → 422 via withHandler
  const { fingerprint } = parseQuery(request, pairingStatusQuerySchema)
  return ok(await getPairingStatus(createAdminClient(), parsedCode, fingerprint), {
    headers: { 'Cache-Control': 'no-store' },
  })
})

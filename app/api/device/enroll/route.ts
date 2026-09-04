/**
 * POST /api/device/enroll — a TV enrolls into a screen by its login code (docs/CONTRACTS.md §15).
 * Public (no session): the code alone identifies the screen. → { device_token, screen_id }.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { enrollScreen } from '@/lib/screens'
import { createAdminClient } from '@/lib/supabase/admin'
import { enrollRequestSchema } from '@/lib/validators/device'

export const dynamic = 'force-dynamic'

export const POST = withHandler(async (request) => {
  const input = await parseBody(request, enrollRequestSchema)
  const state = await enrollScreen(createAdminClient(), input.code, input.fingerprint)
  return ok(state, { status: 201, headers: { 'Cache-Control': 'no-store' } })
})

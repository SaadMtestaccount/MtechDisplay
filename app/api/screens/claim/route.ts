import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { claimScreen } from '@/lib/screens'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimScreenSchema } from '@/lib/validators/screens'

/** POST /api/screens/claim — claims a pairing code, creates the screen (201). */
export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const input = await parseBody(request, claimScreenSchema)
  return ok(await claimScreen(ctx, createAdminClient(), input), { status: 201 })
})

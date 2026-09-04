/**
 * POST /api/screens/[id]/regenerate-code — new login code + revoke the bound TV (§15). → ScreenView.
 */
import { ok, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { regenerateScreenCode } from '@/lib/screens'
import { createAdminClient } from '@/lib/supabase/admin'

export const POST = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const org = await requireOrgContext()
  return ok(await regenerateScreenCode(org, createAdminClient(), id))
})

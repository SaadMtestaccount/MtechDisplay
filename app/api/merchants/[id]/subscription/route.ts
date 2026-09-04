/** POST /api/merchants/[id]/subscription — set a merchant's (dummy) subscription tier. Super admin only. */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { setMerchantSubscription } from '@/lib/merchants'
import { createAdminClient } from '@/lib/supabase/admin'
import { setSubscriptionSchema } from '@/lib/validators/merchants'
import type { OkResponse } from '@/types/api'

export const POST = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  await requireSuperAdmin()
  const { tier } = await parseBody(request, setSubscriptionSchema)
  await setMerchantSubscription(createAdminClient(), id, tier)
  return ok<OkResponse>({ ok: true })
})

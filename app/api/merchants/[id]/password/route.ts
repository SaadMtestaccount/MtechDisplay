/** POST /api/merchants/[id]/password — reset a merchant's login password. Super admin only. */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { setMerchantPassword } from '@/lib/merchants'
import { createAdminClient } from '@/lib/supabase/admin'
import { setMerchantPasswordSchema } from '@/lib/validators/merchants'
import type { OkResponse } from '@/types/api'

export const POST = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  await requireSuperAdmin()
  const { password } = await parseBody(request, setMerchantPasswordSchema)
  await setMerchantPassword(createAdminClient(), id, password)
  return ok<OkResponse>({ ok: true })
})

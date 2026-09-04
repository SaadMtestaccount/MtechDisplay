/** POST /api/merchants/[id]/locations — add a location to a merchant (optionally copy from one). */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { addMerchantLocation } from '@/lib/merchants'
import { createAdminClient } from '@/lib/supabase/admin'
import { addLocationSchema } from '@/lib/validators/merchants'

export const POST = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  await requireSuperAdmin()
  const input = await parseBody(request, addLocationSchema)
  return ok(await addMerchantLocation(createAdminClient(), id, input), { status: 201 })
})

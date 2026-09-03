/**
 * /api/merchants — merchant TV accounts (CONTRACTS addendum §13). Super admin only.
 * GET → MerchantView[]; POST { email, password, org_id } → 201 MerchantView.
 * DELETE reuses /api/users/[id].
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { createMerchant, listMerchants } from '@/lib/merchants'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMerchantSchema } from '@/lib/validators/merchants'

export const GET = withHandler(async () => {
  await requireSuperAdmin()
  return ok(await listMerchants(createAdminClient()))
})

export const POST = withHandler(async (request) => {
  await requireSuperAdmin()
  const input = await parseBody(request, createMerchantSchema)
  return ok(await createMerchant(createAdminClient(), input), { status: 201 })
})

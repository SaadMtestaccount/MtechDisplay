/**
 * /api/merchants/[id] — GET one merchant; DELETE the merchant (removes their login and every
 * location that belongs only to them, cascading its screens/content/menus). Super admin only.
 */
import { ok, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { deleteMerchant, getMerchant } from '@/lib/merchants'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OkResponse } from '@/types/api'

export const GET = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  await requireSuperAdmin()
  return ok(await getMerchant(createAdminClient(), id))
})

export const DELETE = withHandler<{ id: string }>(async (_request, ctx) => {
  const { id } = await ctx.params
  const session = await requireSuperAdmin()
  await deleteMerchant(createAdminClient(), id, session.user.id)
  return ok<OkResponse>({ ok: true })
})

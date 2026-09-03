/**
 * /api/users/[id] — DELETE (remove a staff user). Auth: super (docs/CONTRACTS.md §6.1).
 * Removing yourself is a 400 (lib/users.removeUser).
 */
import { ok, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeUser } from '@/lib/users'
import type { OkResponse } from '@/types/api'

export const DELETE = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const session = await requireSuperAdmin()
  await removeUser(createAdminClient(), id, session.user.id)
  return ok<OkResponse>({ ok: true })
})

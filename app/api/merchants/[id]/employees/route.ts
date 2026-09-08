/** POST /api/merchants/[id]/employees — add an employee login under a merchant (§19). Super admin only. */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { createEmployee } from '@/lib/merchants'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEmployeeSchema } from '@/lib/validators/merchants'

export const POST = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  await requireSuperAdmin()
  const input = await parseBody(request, createEmployeeSchema)
  return ok(await createEmployee(createAdminClient(), id, input), { status: 201 })
})

/**
 * /api/merchants/[id]/employees/[employeeId] — PATCH access level / locations, DELETE the login (§19).
 * Super admin only. Password resets reuse POST /api/merchants/[employeeId]/password.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { deleteEmployee, updateEmployee } from '@/lib/merchants'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateEmployeeSchema } from '@/lib/validators/merchants'
import type { OkResponse } from '@/types/api'

export const PATCH = withHandler<{ id: string; employeeId: string }>(async (request, ctx) => {
  const { id, employeeId } = await ctx.params
  await requireSuperAdmin()
  const input = await parseBody(request, updateEmployeeSchema)
  return ok(await updateEmployee(createAdminClient(), id, employeeId, input))
})

export const DELETE = withHandler<{ id: string; employeeId: string }>(async (_request, ctx) => {
  const { id, employeeId } = await ctx.params
  await requireSuperAdmin()
  await deleteEmployee(createAdminClient(), id, employeeId)
  return ok<OkResponse>({ ok: true })
})

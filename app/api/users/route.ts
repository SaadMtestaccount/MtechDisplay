/**
 * /api/users — GET (list MTech staff), POST (invite; created as super admin).
 * Auth: super (docs/CONTRACTS.md §6.1).
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteUser, listUsers } from '@/lib/users'
import { inviteUserSchema } from '@/lib/validators/users'

export const GET = withHandler(async () => {
  await requireSuperAdmin()
  return ok(await listUsers(createAdminClient()))
})

export const POST = withHandler(async (request) => {
  await requireSuperAdmin()
  const { email } = await parseBody(request, inviteUserSchema)
  return ok(await inviteUser(createAdminClient(), email), { status: 201 })
})

/**
 * /api/content/delete-expired — POST deletes every expired item of the active org.
 * docs/CONTRACTS.md §6.1.
 */
import type { DeletedResponse } from '@/types/api'
import { ok, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { deleteExpired } from '@/lib/content'
import { createAdminClient } from '@/lib/supabase/admin'

export const POST = withHandler(async () => {
  const ctx = await requireOrgContext()
  return ok<DeletedResponse>({ deleted: await deleteExpired(ctx, createAdminClient()) })
})

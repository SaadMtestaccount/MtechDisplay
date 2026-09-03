/**
 * /api/content/expired-count — GET number of expired items in the active org.
 * docs/CONTRACTS.md §6.1.
 */
import type { CountResponse } from '@/types/api'
import { ok, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { countExpired } from '@/lib/content'

export const GET = withHandler(async () => {
  const ctx = await requireOrgContext()
  return ok<CountResponse>({ count: await countExpired(ctx.supabase, ctx.org.id) })
})

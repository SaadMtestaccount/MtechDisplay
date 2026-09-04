/**
 * POST /api/screens/[id]/assign — Screen Wall: put a menu / board / web page on a screen and
 * pin it, or clear it (docs/CONTRACTS.md §14). Refuses if the screen is locked. → ScreenView.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { assignScreen } from '@/lib/screens'
import { createAdminClient } from '@/lib/supabase/admin'
import { assignScreenSchema } from '@/lib/validators/screens'

export const POST = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const org = await requireOrgContext()
  const input = await parseBody(request, assignScreenSchema)
  return ok(await assignScreen(org, createAdminClient(), id, input))
})

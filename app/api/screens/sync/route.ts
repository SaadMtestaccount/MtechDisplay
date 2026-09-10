/**
 * POST /api/screens/sync — sync or unsync several TVs at once with ONE starting line, so the
 * selection restarts its loop from 0:00 together (§21). Org-scoped; returns how many were updated.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { setScreensSync } from '@/lib/screens/mutations'
import { createAdminClient } from '@/lib/supabase/admin'
import { screensSyncSchema } from '@/lib/validators/screens'

export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const { ids, sync } = await parseBody(request, screensSyncSchema)
  return ok(await setScreensSync(ctx, createAdminClient(), ids, sync))
})

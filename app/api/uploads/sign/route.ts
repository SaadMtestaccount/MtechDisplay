/**
 * /api/uploads/sign — POST mints a content id and a signed upload URL for the media bucket.
 * docs/CONTRACTS.md §6.1, §5.14.
 */
import { ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { signUpload } from '@/lib/uploads'
import { uploadSignSchema } from '@/lib/validators/uploads'

export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const input = await parseBody(request, uploadSignSchema)
  return ok(await signUpload(ctx, createAdminClient(), input))
})

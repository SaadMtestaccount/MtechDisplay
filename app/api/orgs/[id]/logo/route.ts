/**
 * POST /api/orgs/[id]/logo — multipart upload of the org logo (field `file`).
 * Auth: super. 422 when the field is missing/not a file or the mime is not in
 * LOGO_MIMES; 413 over MAX_LOGO_BYTES. lib/organizations.uploadOrgLogo
 * re-validates and stores the file (docs/CONTRACTS.md §5.22, §6.1).
 */
import { ApiError, ok, withHandler } from '@/lib/api'
import { requireSuperAdmin } from '@/lib/auth'
import { uploadOrgLogo } from '@/lib/organizations'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOGO_MIMES, MAX_LOGO_BYTES } from '@/types/api'

export const POST = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const session = await requireSuperAdmin()

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new ApiError(400, 'Invalid form data')
  }

  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(422, 'A "file" field with the logo is required')
  if (!(LOGO_MIMES as readonly string[]).includes(file.type)) {
    throw new ApiError(422, 'Logo must be a JPEG, PNG, WebP, GIF or SVG image')
  }
  if (file.size > MAX_LOGO_BYTES) throw new ApiError(413, 'Logo must be 5 MB or smaller')

  return ok(await uploadOrgLogo(session, createAdminClient(), id, file))
})

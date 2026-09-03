/**
 * /api/content/[id]/url — GET a 1h signed URL; `?download=1` adds the attachment
 * disposition named after the content (decision §0.11). docs/CONTRACTS.md §6.1.
 */
import { ApiError, ok, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { getContent, getContentUrl } from '@/lib/content'
import { createAdminClient } from '@/lib/supabase/admin'
import { contentUrlQuerySchema } from '@/lib/validators/content'
import { uuidSchema } from '@/lib/validators/common'
import type { UrlResponse } from '@/types/api'

export const GET = withHandler<{ id: string }>(async (request, ctx) => {
  const parsed = uuidSchema.safeParse((await ctx.params).id)
  if (!parsed.success) throw new ApiError(404, 'Content not found')
  const ctxOrg = await requireOrgContext()
  const { download } = parseQuery(request, contentUrlQuerySchema)
  const content = await getContent(ctxOrg.supabase, ctxOrg.org.id, parsed.data)
  const url = await getContentUrl(createAdminClient(), content, download)
  return ok<UrlResponse>({ url })
})

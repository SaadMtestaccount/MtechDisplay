/**
 * /api/content — GET list (ContentView[]), POST create row for an uploaded object (201).
 * docs/CONTRACTS.md §6.1.
 */
import { ok, parseBody, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { createContent, listContent } from '@/lib/content'
import { createAdminClient } from '@/lib/supabase/admin'
import { contentCreateSchema, contentListQuerySchema } from '@/lib/validators/content'

export const GET = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const query = parseQuery(request, contentListQuerySchema)
  return ok(await listContent(ctx.supabase, ctx.org.id, query))
})

export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const input = await parseBody(request, contentCreateSchema)
  return ok(await createContent(ctx, createAdminClient(), input), { status: 201 })
})

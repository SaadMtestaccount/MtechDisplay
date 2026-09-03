/**
 * /api/folders — GET list (FolderView[], name asc), POST create (201).
 * docs/CONTRACTS.md §6.1.
 */
import { ok, parseBody, parseQuery, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { createFolder, listFolders } from '@/lib/folders'
import { folderInputSchema, folderListQuerySchema } from '@/lib/validators/folders'

export const GET = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const query = parseQuery(request, folderListQuerySchema)
  return ok(await listFolders(ctx.supabase, ctx.org.id, query))
})

export const POST = withHandler(async (request) => {
  const ctx = await requireOrgContext()
  const input = await parseBody(request, folderInputSchema)
  return ok(await createFolder(ctx, input), { status: 201 })
})

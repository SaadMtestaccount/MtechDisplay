/**
 * /api/folders/[id] — PATCH rename, DELETE (content inside becomes unfiled).
 * docs/CONTRACTS.md §6.1.
 */
import { ApiError, ok, parseBody, withHandler } from '@/lib/api'
import { requireOrgContext } from '@/lib/auth'
import { deleteFolder, renameFolder } from '@/lib/folders'
import { folderInputSchema } from '@/lib/validators/folders'
import { uuidSchema } from '@/lib/validators/common'
import type { OkResponse } from '@/types/api'

function parseId(raw: string): string {
  const result = uuidSchema.safeParse(raw)
  if (!result.success) throw new ApiError(404, 'Folder not found')
  return result.data
}

export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const id = parseId((await ctx.params).id)
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, folderInputSchema)
  return ok(await renameFolder(ctxOrg, id, input))
})

export const DELETE = withHandler<{ id: string }>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id)
  const ctxOrg = await requireOrgContext()
  await deleteFolder(ctxOrg, id)
  return ok<OkResponse>({ ok: true })
})

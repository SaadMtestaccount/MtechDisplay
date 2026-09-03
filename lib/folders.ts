/**
 * lib/folders.ts — folder CRUD (docs/CONTRACTS.md §5.16). Server-only.
 */
import type { DbClient, Folder } from '@/types/db'
import type { FolderListQuery, FolderView } from '@/types/api'
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { notifyOrgChanged } from '@/lib/broadcast'
import { escapeLike } from '@/lib/utils'
import type { FolderInput } from '@/lib/validators/folders'

export const FOLDER_SELECT = '*, content(count)' as const

type FolderSource = Folder & { content: { count: number }[] }

export function toFolderView(row: FolderSource): FolderView {
  const { content, ...folder } = row
  return { ...folder, item_count: content[0]?.count ?? 0 }
}

export async function listFolders(supabase: DbClient, orgId: string, query: FolderListQuery): Promise<FolderView[]> {
  let q = supabase.from('folders').select(FOLDER_SELECT).eq('org_id', orgId)
  if (query.q) q = q.ilike('name', `%${escapeLike(query.q)}%`)
  const { data, error } = await q.order('name', { ascending: true })
  if (error) throw error
  return data.map(toFolderView)
}

async function getFolderSource(supabase: DbClient, orgId: string, id: string): Promise<FolderSource> {
  const { data, error } = await supabase
    .from('folders')
    .select(FOLDER_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Folder not found')
  return data
}

export async function createFolder(ctx: OrgContext, input: FolderInput): Promise<FolderView> {
  const { data, error } = await ctx.supabase
    .from('folders')
    .insert({ org_id: ctx.org.id, name: input.name })
    .select('*')
    .single()
  if (error) throw error
  await notifyOrgChanged(ctx.org.id, 'folders', data.id)
  return { ...data, item_count: 0 }
}

export async function renameFolder(ctx: OrgContext, id: string, input: FolderInput): Promise<FolderView> {
  await getFolderSource(ctx.supabase, ctx.org.id, id)
  const { error } = await ctx.supabase
    .from('folders')
    .update({ name: input.name })
    .eq('org_id', ctx.org.id)
    .eq('id', id)
  if (error) throw error
  const view = toFolderView(await getFolderSource(ctx.supabase, ctx.org.id, id))
  await notifyOrgChanged(ctx.org.id, 'folders', id)
  await notifyOrgChanged(ctx.org.id, 'content')
  return view
}

/** Deletes the folder; its content becomes unfiled (`content.folder_id` → null by FK). */
export async function deleteFolder(ctx: OrgContext, id: string): Promise<void> {
  await getFolderSource(ctx.supabase, ctx.org.id, id)
  const { error } = await ctx.supabase.from('folders').delete().eq('org_id', ctx.org.id).eq('id', id)
  if (error) throw error
  await notifyOrgChanged(ctx.org.id, 'folders', id)
  await notifyOrgChanged(ctx.org.id, 'content')
}

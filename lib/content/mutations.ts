/**
 * lib/content/mutations.ts — content create / update / delete (docs/CONTRACTS.md §5.15). Server-only.
 */
import type { DbClient, TablesUpdate } from '@/types/db'
import type { ContentView } from '@/types/api'
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { notifyOrgChanged } from '@/lib/broadcast'
import { logEvent } from '@/lib/events'
import { touchPlaylist } from '@/lib/playlists'
import { contentTypeForMime, extensionForMime, mediaPath, removeObjects, thumbPath } from '@/lib/storage'
import type { ContentCreateInput, ContentUpdateInput } from '@/lib/validators/content'
import { getContentSource, toContentView } from '@/lib/content/queries'
import { playlistIdsUsingContent } from '@/lib/content/usage'

async function assertFolderInOrg(ctx: OrgContext, folderId: string): Promise<void> {
  const { data, error } = await ctx.supabase
    .from('folders')
    .select('id')
    .eq('org_id', ctx.org.id)
    .eq('id', folderId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(422, 'Unknown folder')
}

async function touchPlaylists(admin: DbClient, playlistIds: string[]): Promise<void> {
  for (const playlistId of playlistIds) await touchPlaylist(admin, playlistId)
}

/** Creates the row after the browser uploaded the object. Trusts nothing derived from the client. */
export async function createContent(ctx: OrgContext, admin: DbClient, input: ContentCreateInput): Promise<ContentView> {
  const ext = extensionForMime(input.mime)
  if (ext === null || input.storage_path !== mediaPath(ctx.org.id, input.id, ext)) {
    throw new ApiError(422, 'Invalid storage path')
  }
  if (input.thumb_path !== null && input.thumb_path !== thumbPath(ctx.org.id, input.id)) {
    throw new ApiError(422, 'Invalid thumbnail path')
  }
  if (input.type !== contentTypeForMime(input.mime)) throw new ApiError(422, 'Type does not match mime')
  if (input.folder_id !== null) await assertFolderInOrg(ctx, input.folder_id)

  const { data, error } = await ctx.supabase
    .from('content')
    .insert({
      id: input.id,
      org_id: ctx.org.id,
      folder_id: input.folder_id,
      name: input.name,
      type: input.type,
      storage_path: input.storage_path,
      thumb_path: input.thumb_path,
      mime: input.mime,
      size_bytes: input.size_bytes,
      width: input.width,
      height: input.height,
      duration_seconds: input.duration_seconds,
      created_by: ctx.user.id,
    })
    .select('*, folders(name)')
    .single()
  if (error) throw error

  await logEvent(admin, {
    org_id: ctx.org.id,
    type: 'content_uploaded',
    payload: { content_id: data.id, name: data.name, type: data.type, size_bytes: data.size_bytes },
  })
  await notifyOrgChanged(ctx.org.id, 'content', data.id)
  return toContentView(data)
}

/** Rename / move / set expiration. An expiration change re-syncs every playlist that uses the item. */
export async function updateContent(
  ctx: OrgContext,
  admin: DbClient,
  id: string,
  input: ContentUpdateInput,
): Promise<ContentView> {
  const existing = await getContentSource(ctx.supabase, ctx.org.id, id)
  if (input.folder_id !== undefined && input.folder_id !== null) await assertFolderInOrg(ctx, input.folder_id)

  const patch: TablesUpdate<'content'> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.folder_id !== undefined) patch.folder_id = input.folder_id
  if (input.expires_at !== undefined) patch.expires_at = input.expires_at

  const { error } = await ctx.supabase.from('content').update(patch).eq('org_id', ctx.org.id).eq('id', id)
  if (error) throw error

  const expiresChanged =
    input.expires_at !== undefined &&
    (input.expires_at === null || existing.expires_at === null
      ? input.expires_at !== existing.expires_at
      : new Date(input.expires_at).getTime() !== new Date(existing.expires_at).getTime())
  if (expiresChanged) await touchPlaylists(admin, await playlistIdsUsingContent(ctx.supabase, id))

  const view = toContentView(await getContentSource(ctx.supabase, ctx.org.id, id))
  await notifyOrgChanged(ctx.org.id, 'content', id)
  return view
}

/**
 * Deletes the row (playlist items cascade), re-syncs affected playlists, removes the storage objects,
 * logs `content_deleted` and notifies the org.
 */
export async function deleteContent(ctx: OrgContext, admin: DbClient, id: string): Promise<void> {
  const existing = await getContentSource(ctx.supabase, ctx.org.id, id)
  const playlistIds = await playlistIdsUsingContent(ctx.supabase, id)

  const { error } = await ctx.supabase.from('content').delete().eq('org_id', ctx.org.id).eq('id', id)
  if (error) throw error

  await touchPlaylists(admin, playlistIds)
  await removeObjects(admin, 'media', [existing.storage_path])
  if (existing.thumb_path !== null) await removeObjects(admin, 'thumbs', [existing.thumb_path])
  await logEvent(admin, {
    org_id: ctx.org.id,
    type: 'content_deleted',
    payload: { content_id: id, name: existing.name },
  })
  await notifyOrgChanged(ctx.org.id, 'content', id)
}

/** Deletes every expired item of the active org; returns how many were removed. */
export async function deleteExpired(ctx: OrgContext, admin: DbClient, now: Date = new Date()): Promise<number> {
  const { data, error } = await ctx.supabase
    .from('content')
    .select('id')
    .eq('org_id', ctx.org.id)
    .lte('expires_at', now.toISOString())
  if (error) throw error
  for (const row of data) await deleteContent(ctx, admin, row.id)
  return data.length
}

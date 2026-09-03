/**
 * lib/websites.ts — website CRUD (docs/CONTRACTS.md §5.17). Server-only.
 */
import type { DbClient, Website } from '@/types/db'
import type { UsageResponse, WebsiteListQuery, WebsiteView } from '@/types/api'
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { notifyOrgChanged } from '@/lib/broadcast'
import { playlistIdsUsingWebsite, usageForPlaylists } from '@/lib/content/usage'
import { touchPlaylist } from '@/lib/playlists'
import { escapeLike, faviconUrl } from '@/lib/utils'
import type { WebsiteInput } from '@/lib/validators/websites'

export { faviconUrl } from '@/lib/utils'

export function toWebsiteView(row: Website): WebsiteView {
  return { ...row, favicon_url: faviconUrl(row.url) }
}

export async function listWebsites(supabase: DbClient, orgId: string, query: WebsiteListQuery): Promise<WebsiteView[]> {
  let q = supabase.from('websites').select('*').eq('org_id', orgId)
  if (query.q) q = q.ilike('name', `%${escapeLike(query.q)}%`)
  const dir = query.dir
  const ordered =
    query.sort === 'newest'
      ? q.order('created_at', { ascending: dir === 'asc' })
      : query.sort === 'oldest'
        ? q.order('created_at', { ascending: dir !== 'desc' })
        : q.order('name', { ascending: dir !== 'desc' })
  const { data, error } = await ordered
  if (error) throw error
  return data.map(toWebsiteView)
}

async function getWebsiteRow(supabase: DbClient, orgId: string, id: string): Promise<Website> {
  const { data, error } = await supabase.from('websites').select('*').eq('org_id', orgId).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Website not found')
  return data
}

export async function getWebsite(supabase: DbClient, orgId: string, id: string): Promise<WebsiteView> {
  return toWebsiteView(await getWebsiteRow(supabase, orgId, id))
}

export async function createWebsite(ctx: OrgContext, input: WebsiteInput): Promise<WebsiteView> {
  const { data, error } = await ctx.supabase
    .from('websites')
    .insert({ org_id: ctx.org.id, name: input.name, url: input.url, refresh_seconds: input.refresh_seconds })
    .select('*')
    .single()
  if (error) throw error
  await notifyOrgChanged(ctx.org.id, 'websites', data.id)
  return toWebsiteView(data)
}

/** A url / refresh change re-syncs every playlist using the site (the manifest carries both). */
export async function updateWebsite(
  ctx: OrgContext,
  admin: DbClient,
  id: string,
  input: WebsiteInput,
): Promise<WebsiteView> {
  const existing = await getWebsiteRow(ctx.supabase, ctx.org.id, id)
  const { data, error } = await ctx.supabase
    .from('websites')
    .update({ name: input.name, url: input.url, refresh_seconds: input.refresh_seconds })
    .eq('org_id', ctx.org.id)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error

  if (existing.url !== data.url || existing.refresh_seconds !== data.refresh_seconds) {
    for (const playlistId of await playlistIdsUsingWebsite(ctx.supabase, id)) await touchPlaylist(admin, playlistId)
  }
  await notifyOrgChanged(ctx.org.id, 'websites', id)
  return toWebsiteView(data)
}

export async function getWebsiteUsage(supabase: DbClient, orgId: string, id: string): Promise<UsageResponse> {
  return usageForPlaylists(supabase, orgId, await playlistIdsUsingWebsite(supabase, id))
}

/** Same sequence as deleteContent minus storage and events: items cascade, affected playlists re-sync. */
export async function deleteWebsite(ctx: OrgContext, admin: DbClient, id: string): Promise<void> {
  await getWebsiteRow(ctx.supabase, ctx.org.id, id)
  const playlistIds = await playlistIdsUsingWebsite(ctx.supabase, id)
  const { error } = await ctx.supabase.from('websites').delete().eq('org_id', ctx.org.id).eq('id', id)
  if (error) throw error
  for (const playlistId of playlistIds) await touchPlaylist(admin, playlistId)
  await notifyOrgChanged(ctx.org.id, 'websites', id)
}

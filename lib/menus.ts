/**
 * lib/menus.ts — SERVER ONLY. Reusable "Menus" = kind='menu' playlists (docs/CONTRACTS.md §14).
 * A menu reuses the whole playlist/playlist_items machinery, so its boards are edited through
 * the existing PUT /api/playlists/[id]/items. Menus are assigned to screens via screens.menu_id.
 */
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { createPlaylist, deletePlaylist, getPlaylistView } from '@/lib/playlists'
import { bumpAndSyncScreens } from '@/lib/screens/mutations'
import { publicThumbUrl } from '@/lib/storage'
import type { MenuView, PlaylistView } from '@/types/api'
import type { DbClient, Playlist } from '@/types/db'

/** All menus in the org, with a board count, a "showing on N screens" count and a cover thumb. */
export async function listMenus(supabase: DbClient, orgId: string): Promise<MenuView[]> {
  const { data: menus, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('org_id', orgId)
    .eq('kind', 'menu')
    .order('name', { ascending: true })
  if (error) throw error
  if (!menus || menus.length === 0) return []
  const ids = menus.map((m) => m.id)

  const { data: items, error: itemsError } = await supabase
    .from('playlist_items')
    .select('playlist_id, content(thumb_path)')
    .in('playlist_id', ids)
    .order('position', { ascending: true })
  if (itemsError) throw itemsError

  const { data: screens, error: screensError } = await supabase
    .from('screens')
    .select('menu_id')
    .in('menu_id', ids)
  if (screensError) throw screensError

  const itemCount = new Map<string, number>()
  const cover = new Map<string, string | null>()
  for (const it of items ?? []) {
    itemCount.set(it.playlist_id, (itemCount.get(it.playlist_id) ?? 0) + 1)
    if (!cover.has(it.playlist_id)) {
      cover.set(it.playlist_id, it.content ? publicThumbUrl(it.content.thumb_path) : null)
    }
  }
  const screenCount = new Map<string, number>()
  for (const s of screens ?? []) {
    if (s.menu_id) screenCount.set(s.menu_id, (screenCount.get(s.menu_id) ?? 0) + 1)
  }

  return menus.map((m) => ({
    ...m,
    item_count: itemCount.get(m.id) ?? 0,
    screen_count: screenCount.get(m.id) ?? 0,
    thumb_url: cover.get(m.id) ?? null,
  }))
}

/** The menu with its ordered boards (reuses the playlist view). 404 unless it is a menu in the org. */
export async function getMenu(supabase: DbClient, orgId: string, id: string): Promise<PlaylistView> {
  const view = await getPlaylistView(supabase, orgId, id)
  if (view.kind !== 'menu') throw new ApiError(404, 'Menu not found')
  return view
}

export async function createMenu(ctx: OrgContext, name: string): Promise<Playlist> {
  return createPlaylist(ctx.supabase, ctx.org.id, name, 'menu')
}

/** Rename only; the menu name is not shown on TVs, so no screen re-sync is needed. */
export async function renameMenu(ctx: OrgContext, id: string, name: string): Promise<Playlist> {
  const { data, error } = await ctx.supabase
    .from('playlists')
    .update({ name })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('kind', 'menu')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Menu not found')
  return data
}

/** Deletes the menu; screens showing it fall back (menu_id → null via FK) and are re-synced. */
export async function deleteMenu(ctx: OrgContext, admin: DbClient, id: string): Promise<void> {
  const { data: menu, error } = await ctx.supabase
    .from('playlists')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('kind', 'menu')
    .maybeSingle()
  if (error) throw error
  if (!menu) throw new ApiError(404, 'Menu not found')

  const { data: screens, error: screensError } = await admin.from('screens').select('id').eq('menu_id', id)
  if (screensError) throw screensError
  const screenIds = (screens ?? []).map((s) => s.id)

  await deletePlaylist(ctx.supabase, id)
  if (screenIds.length > 0) await bumpAndSyncScreens(admin, screenIds)
}

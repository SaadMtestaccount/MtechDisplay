/**
 * lib/screens/assign.ts — SERVER ONLY. Screen Wall assignment (docs/CONTRACTS.md §14).
 * Put a menu / single board / single web page on a screen and pin it, or clear it:
 *   - menu     → screens.menu_id (a shared reference; menu edits reach every screen showing it)
 *   - content  → the screen's OWN playlist = [that board], detached from menu + group so it shows
 *   - website  → the screen's OWN playlist = [that web page], detached from menu + group
 *   - clear    → own playlist emptied, menu + group detached, unlocked (screen → standby)
 * A drop pins the screen (locked = true); a locked screen refuses changes until unlocked.
 */
import { randomUUID } from 'node:crypto'
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { notifyOrgChanged } from '@/lib/broadcast'
import { createPlaylist, savePlaylistItems } from '@/lib/playlists'
import { bumpAndSyncScreens } from '@/lib/screens/mutations'
import { getScreenView } from '@/lib/screens/views'
import type { PlaylistItemInput } from '@/lib/validators/playlists'
import type { AssignScreenInput } from '@/lib/validators/screens'
import type { ScreenView } from '@/types/api'
import type { DbClient } from '@/types/db'

function singleItem(input: Extract<AssignScreenInput, { kind: 'content' | 'website' }>): PlaylistItemInput {
  const base = {
    id: randomUUID(),
    duration_seconds: null,
    transition: 'fade' as const,
    mute: true,
    active_from: null,
    active_to: null,
    days_of_week: null,
    daily_start: null,
    daily_end: null,
  }
  return input.kind === 'content'
    ? { ...base, item_type: 'content', content_id: input.content_id, website_id: null }
    : { ...base, item_type: 'website', content_id: null, website_id: input.website_id }
}

async function ensureOwnPlaylist(ctx: OrgContext, id: string, screen: ScreenView): Promise<string> {
  if (screen.playlist_id) return screen.playlist_id
  const playlist = await createPlaylist(ctx.supabase, ctx.org.id, screen.name, 'screen')
  const { error } = await ctx.supabase
    .from('screens')
    .update({ playlist_id: playlist.id })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
  if (error) throw error
  return playlist.id
}

export async function assignScreen(
  ctx: OrgContext,
  admin: DbClient,
  id: string,
  input: AssignScreenInput,
): Promise<ScreenView> {
  const screen = await getScreenView(ctx.supabase, ctx.org.id, id)
  if (screen.locked) {
    throw new ApiError(409, 'This screen is locked. Unlock it before changing what it shows.')
  }

  if (input.kind === 'menu') {
    const { data: menu, error } = await ctx.supabase
      .from('playlists')
      .select('id')
      .eq('id', input.menu_id)
      .eq('org_id', ctx.org.id)
      .eq('kind', 'menu')
      .maybeSingle()
    if (error) throw error
    if (!menu) throw new ApiError(422, 'Unknown menu')

    const { error: updateError } = await ctx.supabase
      .from('screens')
      .update({ menu_id: input.menu_id, locked: true })
      .eq('id', id)
      .eq('org_id', ctx.org.id)
    if (updateError) throw updateError

    await bumpAndSyncScreens(admin, [id])
    await notifyOrgChanged(ctx.org.id, 'screens', id)
    return getScreenView(ctx.supabase, ctx.org.id, id)
  }

  // content / website / clear → the screen's own playlist, detached from menu + group.
  const playlistId = await ensureOwnPlaylist(ctx, id, screen)
  const { error: detachError } = await ctx.supabase
    .from('screens')
    .update({ menu_id: null, group_id: null, locked: input.kind !== 'clear' })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
  if (detachError) throw detachError

  const items: PlaylistItemInput[] = input.kind === 'clear' ? [] : [singleItem(input)]
  await savePlaylistItems(ctx, admin, playlistId, items)
  if (screen.group_id) await notifyOrgChanged(ctx.org.id, 'groups')
  await notifyOrgChanged(ctx.org.id, 'screens', id)
  return getScreenView(ctx.supabase, ctx.org.id, id)
}

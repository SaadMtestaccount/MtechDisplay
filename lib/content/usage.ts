/**
 * lib/content/usage.ts — "which screens/groups play this item" (docs/CONTRACTS.md §5.15, §5.17).
 * A screen counts when its EFFECTIVE playlist (group playlist if grouped, else its own) contains the item.
 */
import type { DbClient } from '@/types/db'
import type { UsageRef, UsageResponse } from '@/types/api'

export async function playlistIdsUsingContent(supabase: DbClient, contentId: string): Promise<string[]> {
  const { data, error } = await supabase.from('playlist_items').select('playlist_id').eq('content_id', contentId)
  if (error) throw error
  return Array.from(new Set(data.map((r) => r.playlist_id)))
}

export async function playlistIdsUsingWebsite(supabase: DbClient, websiteId: string): Promise<string[]> {
  const { data, error } = await supabase.from('playlist_items').select('playlist_id').eq('website_id', websiteId)
  if (error) throw error
  return Array.from(new Set(data.map((r) => r.playlist_id)))
}

function byName(a: UsageRef, b: UsageRef): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/** Screens and groups of the org whose effective playlist is one of `playlistIds`. */
export async function usageForPlaylists(
  supabase: DbClient,
  orgId: string,
  playlistIds: string[],
): Promise<UsageResponse> {
  if (playlistIds.length === 0) return { screens: [], groups: [] }
  const playlistSet = new Set(playlistIds)

  const [{ data: groupRows, error: groupError }, { data: screenRows, error: screenError }] = await Promise.all([
    supabase.from('screen_groups').select('id, name, playlist_id').eq('org_id', orgId),
    supabase.from('screens').select('id, name, playlist_id, group_id').eq('org_id', orgId),
  ])
  if (groupError) throw groupError
  if (screenError) throw screenError

  const groupPlaylist = new Map(groupRows.map((g) => [g.id, g.playlist_id] as const))
  const groups: UsageRef[] = groupRows
    .filter((g) => playlistSet.has(g.playlist_id))
    .map((g) => ({ id: g.id, name: g.name }))
  const screens: UsageRef[] = screenRows
    .filter((s) => {
      const effective = s.group_id !== null ? (groupPlaylist.get(s.group_id) ?? null) : s.playlist_id
      return effective !== null && playlistSet.has(effective)
    })
    .map((s) => ({ id: s.id, name: s.name }))

  return { screens: screens.sort(byName), groups: groups.sort(byName) }
}

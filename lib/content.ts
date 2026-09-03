/**
 * lib/content.ts — content library (docs/CONTRACTS.md §5.15). Server-only.
 * Split per the §1.1 rule: reads in lib/content/queries.ts, writes in lib/content/mutations.ts,
 * usage lookups in lib/content/usage.ts. This module re-exports the contracted names.
 */
import type { DbClient } from '@/types/db'
import type { UsageResponse } from '@/types/api'
import { playlistIdsUsingContent, usageForPlaylists } from '@/lib/content/usage'

export {
  CONTENT_SELECT, countExpired, getContent, getContentSource, getContentUrl, isContentExpired, listContent,
  toContentView, type ContentSource,
} from '@/lib/content/queries'
export { createContent, deleteContent, deleteExpired, updateContent } from '@/lib/content/mutations'
export { playlistIdsUsingContent } from '@/lib/content/usage'

/** Screens (by effective playlist) and groups whose playlist contains the item. */
export async function getContentUsage(supabase: DbClient, orgId: string, id: string): Promise<UsageResponse> {
  return usageForPlaylists(supabase, orgId, await playlistIdsUsingContent(supabase, id))
}

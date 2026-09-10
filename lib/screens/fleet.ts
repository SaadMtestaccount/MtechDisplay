/**
 * lib/screens/fleet.ts — SERVER ONLY, service role. The super-admin fleet (docs/CONTRACTS.md §23):
 * every TV of every location in one list, and group actions that cross locations. Callers must
 * have passed requireSuperAdmin().
 */
import { broadcastToScreens, notifyOrgChanged } from '@/lib/broadcast'
import { bumpAndSyncScreens } from '@/lib/screens/mutations'
import { asScreenSources, attachScreenPreviews, screenQuery, toScreenView } from '@/lib/screens/select'
import type { FleetAction, FleetScreenView } from '@/types/api'
import type { DbClient } from '@/types/db'

export async function listAllScreens(admin: DbClient): Promise<FleetScreenView[]> {
  const [screens, orgs] = await Promise.all([
    screenQuery(admin).order('name', { ascending: true }),
    admin.from('organizations').select('id, name'),
  ])
  if (screens.error) throw screens.error
  if (orgs.error) throw orgs.error
  const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name] as const))
  const now = new Date()
  const views = asScreenSources(screens.data).map((row) => toScreenView(row, now))
  await attachScreenPreviews(admin, views)
  return views
    .map((v) => ({ ...v, org_name: orgName.get(v.org_id) ?? 'Unknown location' }))
    .sort((a, b) => a.org_name.localeCompare(b.org_name) || a.name.localeCompare(b.name))
}

/**
 * One action for a selection that may span locations. sync/unsync share ONE starting line
 * (§21); identify/reload ride each screen's command channel. Every touched location gets a
 * `changed` broadcast so open consoles refresh.
 */
export async function fleetAction(admin: DbClient, ids: string[], action: FleetAction): Promise<{ updated: number }> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return { updated: 0 }
  const { data: rows, error } = await admin.from('screens').select('id, org_id').in('id', unique)
  if (error) throw error
  const found = rows ?? []
  const foundIds = found.map((r) => r.id)
  if (foundIds.length === 0) return { updated: 0 }

  if (action === 'sync' || action === 'unsync') {
    const sync = action === 'sync'
    const { error: updateError } = await admin
      .from('screens')
      .update({ sync, sync_started_at: sync ? new Date().toISOString() : null })
      .in('id', foundIds)
    if (updateError) throw updateError
    await bumpAndSyncScreens(admin, foundIds)
  } else {
    await broadcastToScreens(foundIds, action)
  }
  for (const orgId of new Set(found.map((r) => r.org_id))) await notifyOrgChanged(orgId, 'screens')
  return { updated: foundIds.length }
}

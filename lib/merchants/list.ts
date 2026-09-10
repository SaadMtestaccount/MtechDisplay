/**
 * lib/merchants/list.ts — SERVER ONLY (service role). The read side of merchants (CONTRACTS
 * addendum §13, §19): every non-staff login that is not an employee, with its locations (plus
 * TV and content tallies) and its employees folded underneath it. Employees never appear as
 * top-level rows.
 */
import { ApiError } from '@/lib/api'
import { isOnline } from '@/lib/status'
import type { EmployeeView, MerchantLocation, MerchantView, SubscriptionTier } from '@/types/api'
import { SUBSCRIPTION_TIERS } from '@/types/api'
import type { DbClient, MembershipRole } from '@/types/db'

/** Coerce a stored tier string to a known tier, defaulting to the first. */
export function toTier(value: string | null | undefined): SubscriptionTier {
  return (SUBSCRIPTION_TIERS as readonly string[]).includes(value ?? '')
    ? (value as SubscriptionTier)
    : SUBSCRIPTION_TIERS[0]
}

type MembershipRow = {
  user_id: string
  org_id: string
  role: MembershipRole
  organizations: { id: string; name: string } | null
}

/** Manager if any membership is admin/owner, else TV only. */
function roleOf(memberships: MembershipRow[]): MembershipRole {
  return memberships.some((m) => m.role === 'admin' || m.role === 'owner') ? 'admin' : 'member'
}

function tally(rows: { org_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.org_id, (counts.get(r.org_id) ?? 0) + 1)
  return counts
}

export async function listMerchants(admin: DbClient): Promise<MerchantView[]> {
  const [memberships, profiles, users, screens, content] = await Promise.all([
    admin
      .from('memberships')
      .select('user_id, org_id, role, organizations(id, name)')
      .order('created_at', { ascending: true }),
    admin.from('profiles').select('id, is_super_admin, subscription_tier, employer_id'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('screens').select('org_id, last_seen_at, device_token_hash'),
    admin.from('content').select('org_id'),
  ])
  if (memberships.error) throw memberships.error
  if (profiles.error) throw profiles.error
  if (users.error) throw users.error
  if (screens.error) throw screens.error
  if (content.error) throw content.error

  const byUser = new Map<string, MembershipRow[]>()
  for (const m of (memberships.data ?? []) as MembershipRow[]) {
    const list = byUser.get(m.user_id) ?? []
    list.push(m)
    byUser.set(m.user_id, list)
  }
  const userById = new Map(users.data.users.map((u) => [u.id, u] as const))
  const now = new Date()
  const screenCount = tally(screens.data ?? [])
  const pairedCount = tally((screens.data ?? []).filter((s) => s.device_token_hash !== null))
  const onlineCount = tally((screens.data ?? []).filter((s) => isOnline(s.last_seen_at, now)))
  const contentCount = tally(content.data ?? [])
  const allProfiles = profiles.data ?? []

  const merchants = new Map<string, MerchantView>()
  for (const p of allProfiles) {
    if (p.is_super_admin || p.employer_id) continue
    const ms = byUser.get(p.id) ?? []
    const user = userById.get(p.id)
    // A login with no location isn't a merchant (a stray seed/staff-less account).
    if (ms.length === 0 || !user) continue
    const locations: MerchantLocation[] = ms.flatMap((m) =>
      m.organizations
        ? [
            {
              id: m.organizations.id,
              name: m.organizations.name,
              screen_count: screenCount.get(m.organizations.id) ?? 0,
              paired_count: pairedCount.get(m.organizations.id) ?? 0,
              online_count: onlineCount.get(m.organizations.id) ?? 0,
              content_count: contentCount.get(m.organizations.id) ?? 0,
            },
          ]
        : [],
    )
    merchants.set(p.id, {
      id: p.id,
      email: user.email ?? '',
      role: roleOf(ms),
      locations,
      employees: [],
      subscription_tier: toTier(p.subscription_tier),
      last_sign_in_at: user.last_sign_in_at ?? null,
      created_at: user.created_at,
    })
  }

  for (const p of allProfiles) {
    if (!p.employer_id) continue
    const owner = merchants.get(p.employer_id)
    const user = userById.get(p.id)
    if (!owner || !user) continue
    const ms = byUser.get(p.id) ?? []
    const employee: EmployeeView = {
      id: p.id,
      email: user.email ?? '',
      role: roleOf(ms),
      location_ids: ms.map((m) => m.org_id),
      last_sign_in_at: user.last_sign_in_at ?? null,
      created_at: user.created_at,
    }
    owner.employees.push(employee)
  }
  for (const m of merchants.values()) m.employees.sort((a, b) => a.email.localeCompare(b.email))
  return Array.from(merchants.values()).sort((a, b) => a.email.localeCompare(b.email))
}

export async function getMerchant(admin: DbClient, userId: string): Promise<MerchantView> {
  const view = (await listMerchants(admin)).find((m) => m.id === userId)
  if (!view) throw new ApiError(404, 'Merchant not found')
  return view
}

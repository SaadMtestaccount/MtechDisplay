'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2Icon, CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import type { MerchantView } from '@/types/api'
import type { Organization } from '@/types/db'

/** A merchant's locations kept together: `orgs[0]` is their first location, the rest sit under it. */
type Group = { key: string; orgs: Organization[] }

/**
 * Switch which location you're viewing. Locations are created and managed on the Team page.
 * A merchant's locations are grouped together (first flush, extras indented) so a super admin
 * browsing every store can see at a glance which locations belong to the same merchant.
 */
export function OrgSwitcher() {
  const { org, orgs, profile, setActiveOrg } = useApp()

  // Only super admins can list merchants; managers just see their own locations.
  const merchantsQuery = useQuery({
    queryKey: queryKeys.merchants.list(),
    queryFn: () => apiFetch<MerchantView[]>('/api/merchants'),
    enabled: profile.is_super_admin,
    staleTime: 60_000,
  })

  const groups = useMemo<Group[]>(() => {
    const byId = new Map(orgs.map((o) => [o.id, o] as const))
    const out: Group[] = []
    const used = new Set<string>()

    if (profile.is_super_admin) {
      for (const m of merchantsQuery.data ?? []) {
        const locs = m.locations.map((l) => byId.get(l.id)).filter((o): o is Organization => !!o)
        if (locs.length === 0) continue
        out.push({ key: m.id, orgs: locs })
        for (const o of locs) used.add(o.id)
      }
    } else {
      // A manager's locations all belong to them — one group.
      if (orgs.length > 0) {
        out.push({ key: 'me', orgs })
        for (const o of orgs) used.add(o.id)
      }
    }
    // Standalone locations with no merchant (e.g. demo/seed orgs) each stand on their own.
    for (const o of orgs) if (!used.has(o.id)) out.push({ key: o.id, orgs: [o] })
    return out.sort((a, b) => (a.orgs[0]?.name ?? '').localeCompare(b.orgs[0]?.name ?? ''))
  }, [orgs, profile.is_super_admin, merchantsQuery.data])

  const handleSelect = async (orgId: string) => {
    if (orgId === org?.id) return
    try {
      await setActiveOrg(orgId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch location')
    }
  }

  // A merchant with a single location neither switches nor sees a menu — just show the name.
  if (!profile.is_super_admin && orgs.length <= 1) {
    return (
      <div className="flex h-8 max-w-52 items-center gap-2 rounded-md border border-border px-3 text-sm">
        <Building2Icon className="size-3.5 text-muted-foreground" />
        <span className="truncate">{org?.name ?? 'No location'}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="max-w-52" />}>
        <Building2Icon className="size-3.5 text-muted-foreground" />
        <span className="truncate">{org?.name ?? 'No location'}</span>
        <ChevronsUpDownIcon className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          {profile.is_super_admin ? 'All locations' : 'Your locations'}
        </div>
        {groups.map((g, gi) => (
          <div key={g.key} className={gi > 0 ? 'mt-1.5' : undefined}>
            {g.orgs.map((o, i) => (
              <DropdownMenuItem
                key={o.id}
                onClick={() => void handleSelect(o.id)}
                className={i > 0 ? 'ml-4 border-l border-border pl-3' : undefined}
              >
                <span className="truncate">{o.name}</span>
                {o.id === org?.id ? <CheckIcon className="ml-auto size-4 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

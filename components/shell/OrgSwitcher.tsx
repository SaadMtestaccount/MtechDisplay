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
import type { MerchantView } from '@/types/api'
import type { Organization } from '@/types/db'

/** A merchant's locations kept together: `orgs[0]` is their first location, the rest sit under it. */
type Group = { key: string; label: string | null; orgs: Organization[] }

/**
 * Switch which location you're viewing. Locations are created and managed on the Merchants page.
 * A merchant's locations are grouped under the merchant's email so a super admin browsing every
 * store can see at a glance which locations belong to the same merchant. `label` replaces the
 * current location's name on the trigger (the admin console uses "Open a location"); `onSelected`
 * runs after the switch (the admin console navigates into the store).
 */
export function OrgSwitcher({ label, onSelected }: { label?: string; onSelected?(orgId: string): void } = {}) {
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
        out.push({ key: m.id, label: m.email, orgs: locs })
        for (const o of locs) used.add(o.id)
      }
    } else {
      // A manager's locations all belong to them — one group.
      if (orgs.length > 0) {
        out.push({ key: 'me', label: null, orgs })
        for (const o of orgs) used.add(o.id)
      }
    }
    // Standalone locations with no merchant (e.g. demo/seed orgs) each stand on their own.
    for (const o of orgs) if (!used.has(o.id)) out.push({ key: o.id, label: null, orgs: [o] })
    return out.sort((a, b) => (a.orgs[0]?.name ?? '').localeCompare(b.orgs[0]?.name ?? ''))
  }, [orgs, profile.is_super_admin, merchantsQuery.data])

  const handleSelect = async (orgId: string) => {
    try {
      if (orgId !== org?.id) await setActiveOrg(orgId)
      onSelected?.(orgId)
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
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="max-w-56" />}>
        <Building2Icon className="size-3.5 text-muted-foreground" />
        <span className="truncate">{label ?? org?.name ?? 'No location'}</span>
        <ChevronsUpDownIcon className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          {profile.is_super_admin ? 'All locations, by merchant' : 'Your locations'}
        </div>
        {groups.map((g, gi) => (
          <div key={g.key} className={gi > 0 ? 'mt-1.5' : undefined}>
            {g.label ? <div className="truncate px-1.5 pt-1 text-[11px] text-muted-foreground">{g.label}</div> : null}
            {g.orgs.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => void handleSelect(o.id)}>
                <span className="truncate">{o.name}</span>
                {o.id === org?.id && !label ? <CheckIcon className="ml-auto size-4 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

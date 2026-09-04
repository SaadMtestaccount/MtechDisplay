'use client'

import { Building2Icon, CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApp } from '@/hooks/useApp'

/**
 * Switch which location you're viewing. Locations are created and managed on the Team page
 * (each merchant owns its locations), so this is a pure switcher — no create here.
 */
export function OrgSwitcher() {
  const { org, orgs, profile, setActiveOrg } = useApp()

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
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => void handleSelect(o.id)}>
            <span className="truncate">{o.name}</span>
            {o.id === org?.id ? <CheckIcon className="ml-auto size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

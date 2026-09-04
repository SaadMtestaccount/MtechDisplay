'use client'

import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { OrgDialog } from '@/components/admin/OrgDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApp } from '@/hooks/useApp'

export function OrgSwitcher() {
  const { org, orgs, profile, setActiveOrg } = useApp()
  const [createOpen, setCreateOpen] = useState(false)

  const handleSelect = async (orgId: string) => {
    if (orgId === org?.id) return
    try {
      await setActiveOrg(orgId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch organization')
    }
  }

  // A store manager with a single organization neither switches nor creates orgs — show the name.
  if (!profile.is_super_admin && orgs.length <= 1) {
    return (
      <div className="flex h-8 max-w-52 items-center gap-2 rounded-md border border-border px-3 text-sm">
        <Building2Icon className="size-3.5 text-muted-foreground" />
        <span className="truncate">{org?.name ?? 'No organization'}</span>
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="max-w-52" />}>
          <Building2Icon className="size-3.5 text-muted-foreground" />
          <span className="truncate">{org?.name ?? 'No organization'}</span>
          <ChevronsUpDownIcon className="size-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {orgs.map((o) => (
            <DropdownMenuItem key={o.id} onClick={() => void handleSelect(o.id)}>
              <span className="truncate">{o.name}</span>
              {o.id === org?.id ? <CheckIcon className="ml-auto size-4 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
          {profile.is_super_admin ? (
            <>
              {orgs.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <PlusIcon />
                New organization
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <OrgDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}

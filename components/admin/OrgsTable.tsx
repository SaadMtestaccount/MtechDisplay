'use client'

import { ArrowRightIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { relativeTime } from '@/lib/utils'
import type { OrganizationView } from '@/types/api'

/** Org list (docs/CONTRACTS.md §9.1): name + active indicator, counts, created, kebab. */
export function OrgsTable({
  orgs,
  activeOrgId,
  onOpen,
  onRename,
  onDelete,
}: {
  orgs: OrganizationView[]
  activeOrgId: string | null
  onOpen(o: OrganizationView): void
  onRename(o: OrganizationView): void
  onDelete(o: OrganizationView): void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Name</TableHead>
            <TableHead>Screens</TableHead>
            <TableHead>Content</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12 pr-4 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => {
            const isActive = org.id === activeOrgId
            return (
              <TableRow key={org.id}>
                <TableCell className="pl-4 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {isActive ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
                    {org.name}
                    {isActive ? <Badge variant="secondary">Active</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{org.screen_count}</TableCell>
                <TableCell className="text-muted-foreground">{org.content_count}</TableCell>
                <TableCell className="text-muted-foreground">{relativeTime(org.created_at)}</TableCell>
                <TableCell className="pr-4 text-right">
                  <KebabMenu
                    label={`Actions for ${org.name}`}
                    items={[
                      { label: 'Open as', icon: <ArrowRightIcon />, onSelect: () => onOpen(org) },
                      { label: 'Rename', icon: <PencilIcon />, onSelect: () => onRename(org) },
                      {
                        label: 'Delete',
                        icon: <Trash2Icon />,
                        destructive: true,
                        separatorBefore: true,
                        onSelect: () => onDelete(org),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

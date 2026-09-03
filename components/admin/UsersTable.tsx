'use client'

import { KebabMenu } from '@/components/shell/KebabMenu'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { relativeTime } from '@/lib/utils'
import type { UserView } from '@/types/api'

/** Staff table (docs/CONTRACTS.md §9.1). Your own row's remove is disabled. */
export function UsersTable({
  users,
  currentUserId,
  onRemove,
}: {
  users: UserView[]
  currentUserId: string
  onRemove(u: UserView): void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="w-12 pr-4 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No users yet. Invite your first teammate.
              </TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="pl-4 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {u.email}
                    {u.id === currentUserId ? <Badge variant="secondary">You</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.full_name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{relativeTime(u.last_sign_in_at)}</TableCell>
                <TableCell className="text-muted-foreground">{relativeTime(u.created_at)}</TableCell>
                <TableCell className="pr-4 text-right">
                  <KebabMenu
                    label={`Actions for ${u.email}`}
                    items={[
                      {
                        label: 'Remove',
                        destructive: true,
                        disabled: u.id === currentUserId,
                        onSelect: () => onRemove(u),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

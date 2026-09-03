'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'
import { UsersTable } from '@/components/admin/UsersTable'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OkResponse, UserView } from '@/types/api'

/** /admin/users — MTech staff table + invite + remove (spec §15). */
export function UsersPage() {
  const { user } = useApp()
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<UserView | null>(null)

  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => apiFetch<UserView[]>('/api/users'),
  })

  const removeMutation = useMutation({
    mutationFn: (target: UserView) => apiFetch<OkResponse>(`/api/users/${target.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
      toast.success('User removed')
      setRemoveTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <>
      <PageHeader
        title="Users"
        description="MTech staff — everyone here is a super admin across all organizations."
        primary={
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlusIcon /> Invite user
          </Button>
        }
      />

      {usersQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : usersQuery.isError ? (
        <p className="text-sm text-destructive">
          {usersQuery.error instanceof Error ? usersQuery.error.message : 'Could not load users.'}
        </p>
      ) : (
        <UsersTable users={usersQuery.data} currentUserId={user.id} onRemove={setRemoveTarget} />
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title={removeTarget ? `Remove ${removeTarget.email}?` : 'Remove user'}
        description="They immediately lose access to every organization. This cannot be undone."
        confirmLabel="Remove"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget && !removeMutation.isPending) removeMutation.mutate(removeTarget)
        }}
      />
    </>
  )
}

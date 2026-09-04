'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'
import { MerchantsSection } from '@/components/admin/MerchantsSection'
import { UsersTable } from '@/components/admin/UsersTable'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OkResponse, UserView } from '@/types/api'

/** /admin/users — the Team page: merchants (stores) first, then MTech staff (spec §15). */
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
        title="Team"
        description="Merchants are the stores that use MSIGN. MTech staff are super admins across every store."
      />

      <MerchantsSection />

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">MTech staff</h2>
            <p className="text-sm text-muted-foreground">Everyone here is a super admin across all stores.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlusIcon /> Invite staff
          </Button>
        </div>

        {usersQuery.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : usersQuery.isError ? (
          <p className="text-sm text-destructive">
            {usersQuery.error instanceof Error ? usersQuery.error.message : 'Could not load staff.'}
          </p>
        ) : (
          <UsersTable users={usersQuery.data} currentUserId={user.id} onRemove={setRemoveTarget} />
        )}
      </section>

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

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { GroupView, OkResponse } from '@/types/api'

/** Destructive confirm: members revert to their own playlists (docs/CONTRACTS.md §5.20). */
export function DeleteGroupDialog({
  group,
  onOpenChange,
}: {
  group: GroupView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const orgId = org?.id ?? null

  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<OkResponse>(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (orgId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all(orgId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      }
      toast.success('Group deleted')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <ConfirmDialog
      open={group !== null}
      onOpenChange={onOpenChange}
      title={group ? `Delete "${group.name}"?` : 'Delete group'}
      description="Screens in this group revert to their own playlists. The group playlist is deleted permanently."
      confirmLabel="Delete"
      destructive
      loading={mutation.isPending}
      onConfirm={() => {
        if (group && !mutation.isPending) mutation.mutate(group.id)
      }}
    />
  )
}

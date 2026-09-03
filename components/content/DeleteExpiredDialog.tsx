'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { CountResponse, DeletedResponse } from '@/types/api'

/** Shows the expired count, then POST /api/content/delete-expired (docs/CONTRACTS.md §9.2). */
export function DeleteExpiredDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()

  const countQuery = useQuery({
    queryKey: queryKeys.content.expiredCount(orgId ?? ''),
    queryFn: () => apiFetch<CountResponse>('/api/content/expired-count'),
    enabled: open && orgId !== null,
  })

  const mutation = useMutation({
    mutationFn: () => apiFetch<DeletedResponse>('/api/content/delete-expired', { method: 'POST' }),
    onSuccess: ({ deleted }) => {
      if (orgId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.content.all(orgId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all(orgId) })
      }
      toast.success(deleted === 1 ? 'Deleted 1 expired item' : `Deleted ${deleted} expired items`)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const count = countQuery.data?.count

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete expired content?"
      destructive
      confirmLabel={count !== undefined && count > 0 ? `Delete ${count} ${count === 1 ? 'item' : 'items'}` : 'Delete'}
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      description={
        countQuery.isPending ? (
          'Counting expired items…'
        ) : countQuery.isError ? (
          'Could not count expired items — you can still try to delete them.'
        ) : count === 0 ? (
          'There is no expired content in this organization right now.'
        ) : (
          <p>
            This permanently deletes{' '}
            <span className="font-semibold text-foreground">
              {count} expired {count === 1 ? 'item' : 'items'}
            </span>{' '}
            and removes {count === 1 ? 'it' : 'them'} from every playlist.
          </p>
        )
      }
    />
  )
}

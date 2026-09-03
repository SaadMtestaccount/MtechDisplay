'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OkResponse, OrganizationView } from '@/types/api'

/**
 * Deleting an org cascades to everything it owns; the confirm requires typing the
 * org name (docs/CONTRACTS.md §9.1, spec §15). router.refresh() re-renders the
 * server layout so the navbar org list (and a deleted active org) update.
 */
export function DeleteOrgDialog({
  org,
  onOpenChange,
}: {
  org: OrganizationView | null
  onOpenChange(open: boolean): void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<OkResponse>(`/api/orgs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success('Organization deleted')
      onOpenChange(false)
      router.refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <ConfirmDialog
      open={org !== null}
      onOpenChange={onOpenChange}
      title={org ? `Delete ${org.name}?` : 'Delete organization'}
      description={
        org
          ? `This permanently deletes ${org.name} — including ${org.screen_count} ${
              org.screen_count === 1 ? 'screen' : 'screens'
            }, ${org.content_count} content ${
              org.content_count === 1 ? 'item' : 'items'
            }, and every playlist, group and website it owns. This cannot be undone.`
          : undefined
      }
      confirmLabel="Delete organization"
      destructive
      confirmText={org?.name}
      loading={mutation.isPending}
      onConfirm={() => {
        if (org && !mutation.isPending) mutation.mutate(org.id)
      }}
    />
  )
}

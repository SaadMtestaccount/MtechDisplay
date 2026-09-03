'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { ContentView, OkResponse, UsageResponse } from '@/types/api'

/**
 * Usage-guarded delete (docs/CONTRACTS.md §9.2, spec §6): loads /api/content/[id]/usage and
 * lists the screens/groups whose playlists contain the item — confirming also strips those
 * playlist items and re-syncs the screens (server side).
 */
export function DeleteContentDialog({
  item,
  onOpenChange,
}: {
  item: ContentView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()
  const itemId = item?.id ?? null

  const usageQuery = useQuery({
    queryKey: queryKeys.content.usage(orgId ?? '', itemId ?? ''),
    queryFn: () => apiFetch<UsageResponse>(`/api/content/${itemId}/usage`),
    enabled: orgId !== null && itemId !== null,
  })

  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<OkResponse>(`/api/content/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (orgId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.content.all(orgId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all(orgId) })
      }
      toast.success('Content deleted')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const usage = usageQuery.data
  const inUse = usage !== undefined && (usage.screens.length > 0 || usage.groups.length > 0)

  return (
    <ConfirmDialog
      open={item !== null}
      onOpenChange={onOpenChange}
      title="Delete content?"
      destructive
      confirmLabel="Delete"
      loading={mutation.isPending}
      onConfirm={() => {
        if (item) mutation.mutate(item.id)
      }}
      description={
        <div className="flex flex-col gap-2">
          <p>
            This permanently deletes <span className="font-semibold text-foreground">{item?.name}</span> and its file.
          </p>
          {usageQuery.isLoading ? <p>Checking where it is used…</p> : null}
          {usageQuery.isError ? <p>Could not check where it is used — it may still be in playlists.</p> : null}
          {inUse && usage ? (
            <>
              <p>It is currently in these playlists; deleting removes it from them and re-syncs the screens:</p>
              <ul className="list-disc pl-5">
                {usage.screens.map((s) => (
                  <li key={s.id}>Screen · {s.name}</li>
                ))}
                {usage.groups.map((g) => (
                  <li key={g.id}>Group · {g.name}</li>
                ))}
              </ul>
            </>
          ) : null}
          {usage !== undefined && !inUse ? <p>It is not used in any playlists.</p> : null}
        </div>
      }
    />
  )
}

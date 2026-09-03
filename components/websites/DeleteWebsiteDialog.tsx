'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OkResponse, UsageResponse, WebsiteView } from '@/types/api'

/**
 * Loads /api/websites/{id}/usage and confirms the delete (docs/CONTRACTS.md §9.3): playlist
 * items using the site are removed and affected screens re-sync.
 */
export function DeleteWebsiteDialog({
  website,
  onOpenChange,
}: {
  website: WebsiteView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const orgId = org?.id ?? null
  const websiteId = website?.id ?? null

  const usageQuery = useQuery({
    queryKey: queryKeys.websites.usage(orgId ?? '', websiteId ?? ''),
    queryFn: () => apiFetch<UsageResponse>(`/api/websites/${websiteId}/usage`),
    enabled: orgId !== null && websiteId !== null,
  })

  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<OkResponse>(`/api/websites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.websites.all(orgId) })
      toast.success('Website deleted')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const usage = usageQuery.data
  const inUse = usage !== undefined && (usage.screens.length > 0 || usage.groups.length > 0)

  return (
    <ConfirmDialog
      open={website !== null}
      onOpenChange={onOpenChange}
      title="Delete website?"
      destructive
      confirmLabel="Delete"
      loading={mutation.isPending}
      onConfirm={() => {
        if (website) mutation.mutate(website.id)
      }}
      description={
        <div className="flex flex-col gap-2">
          <p>
            This permanently deletes <span className="font-semibold text-foreground">{website?.name}</span>.
          </p>
          {usageQuery.isLoading ? <p>Checking where it is used…</p> : null}
          {usageQuery.isError ? <p>Could not check where it is used — it may still be in playlists.</p> : null}
          {inUse && usage ? (
            <>
              <p>It is used by the following playlists; its playlist items will be removed:</p>
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

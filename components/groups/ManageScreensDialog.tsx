'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { GroupScreensPanel } from '@/components/groups/GroupScreensPanel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus } from '@/lib/status'
import type { GroupDetailView, GroupView, ScreenListQuery, ScreenView } from '@/types/api'

const SCREENS_QUERY: ScreenListQuery = { sort: 'name' }

/** The GroupScreensPanel checklist in a dialog, for the list page. Open while `group` is set. */
export function ManageScreensDialog({
  group,
  onOpenChange,
}: {
  group: GroupView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const orgId = org?.id ?? null
  const groupId = group?.id ?? null
  const open = groupId !== null

  const detailQuery = useQuery({
    queryKey: queryKeys.groups.detail(orgId ?? 'none', groupId ?? 'none'),
    queryFn: () => apiFetch<GroupDetailView>(`/api/groups/${groupId}`),
    enabled: open && orgId !== null,
  })
  const screensQuery = useQuery({
    queryKey: queryKeys.screens.list(orgId ?? 'none', SCREENS_QUERY),
    queryFn: () => apiFetch<ScreenView[]>(`/api/screens${buildQuery({ sort: SCREENS_QUERY.sort })}`),
    enabled: open && orgId !== null,
  })

  const screens = useMemo(
    () => (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now)),
    [screensQuery.data, statuses, now],
  )

  const mutation = useMutation({
    mutationFn: ({ id, screenIds }: { id: string; screenIds: string[] }) =>
      apiFetch<GroupDetailView>(`/api/groups/${id}/screens`, { method: 'PUT', json: { screen_ids: screenIds } }),
    onSuccess: (data) => {
      if (orgId) {
        queryClient.setQueryData(queryKeys.groups.detail(orgId, data.id), data)
        void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all(orgId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      }
      toast.success('Screens updated')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const detail = detailQuery.data
  const loading = detailQuery.isPending || screensQuery.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group ? `Manage screens — ${group.name}` : 'Manage screens'}</DialogTitle>
          <DialogDescription>
            Checking a screen assigns it to this group, so it plays the group playlist.
          </DialogDescription>
        </DialogHeader>
        {open && loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : open && detail ? (
          <GroupScreensPanel
            group={detail}
            screens={screens}
            onChange={(ids) => {
              if (groupId) mutation.mutate({ id: groupId, screenIds: ids })
            }}
            saving={mutation.isPending}
          />
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

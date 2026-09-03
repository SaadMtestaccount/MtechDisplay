'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { GroupBanner } from '@/components/playlist/GroupBanner'
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor'
import { ScreenHeader } from '@/components/screens/ScreenHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus } from '@/lib/status'
import type { GroupListQuery, GroupView, PlaylistView, ScreenDetailView } from '@/types/api'

const GROUPS_QUERY: GroupListQuery = { sort: 'name' }

/**
 * /screens/[id] page component: realtime-merged header + the playlist editor for the
 * EFFECTIVE playlist (GroupBanner when grouped — the editor then edits the group playlist).
 */
export function ScreenDetail({ id }: { id: string }) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow()
  const orgId = org?.id ?? null

  const detailQuery = useQuery({
    queryKey: queryKeys.screens.detail(orgId ?? 'none', id),
    queryFn: () => apiFetch<ScreenDetailView>(`/api/screens/${id}`),
    enabled: orgId !== null,
  })
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(orgId ?? 'none', GROUPS_QUERY),
    queryFn: () => apiFetch<GroupView[]>(`/api/groups${buildQuery({ sort: GROUPS_QUERY.sort })}`),
    enabled: orgId !== null,
  })

  if (!org) return <NoOrgState />

  if (detailQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const detail = detailQuery.data
  if (detailQuery.isError || !detail) {
    return (
      <EmptyState
        title="Screen not found"
        description="It may have been deleted, or it belongs to another organization."
        action={
          <Button variant="outline" render={<Link href="/screens" />}>
            Back to Screens
          </Button>
        }
      />
    )
  }

  // Realtime merge: last_seen_at / current_item_id / online from the latest heartbeat
  // payload; the CurrentItemView refreshes via the immediate detail invalidation (§8).
  const merged: ScreenDetailView = { ...detail, ...mergeScreenStatus(detail, statuses[detail.id], now) }

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        render={<Link href="/screens" />}
      >
        <ArrowLeftIcon />
        Screens
      </Button>

      <ScreenHeader screen={merged} groups={groupsQuery.data ?? []} now={now} />

      {merged.playlist ? (
        <PlaylistEditor
          key={merged.playlist.id}
          playlistId={merged.playlist.id}
          initial={merged.playlist}
          banner={
            merged.group ? <GroupBanner groupName={merged.group.name} groupId={merged.group.id} /> : undefined
          }
          onSaved={(v: PlaylistView) => {
            if (orgId) {
              queryClient.setQueryData<ScreenDetailView>(queryKeys.screens.detail(orgId, id), (prev) =>
                prev ? { ...prev, playlist: v } : prev,
              )
            }
          }}
        />
      ) : (
        <EmptyState
          title="This screen has no playlist"
          description="Reload the page to create one automatically."
        />
      )}
    </div>
  )
}

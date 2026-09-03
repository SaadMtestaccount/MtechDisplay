'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, UsersIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { GroupScreensPanel } from '@/components/groups/GroupScreensPanel'
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus } from '@/lib/status'
import type { GroupDetailView, GroupView, PlaylistView, ScreenListQuery, ScreenView } from '@/types/api'

const SCREENS_QUERY: ScreenListQuery = { sort: 'name' }

/** /groups/[id] page component: group playlist editor + membership sidebar. */
export function GroupEditor({ id }: { id: string }) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const cancelRef = useRef(false)
  const orgId = org?.id ?? null

  const detailQuery = useQuery({
    queryKey: queryKeys.groups.detail(orgId ?? 'none', id),
    queryFn: () => apiFetch<GroupDetailView>(`/api/groups/${id}`),
    enabled: orgId !== null,
  })
  const groupName = detailQuery.data?.name ?? ''

  useEffect(() => {
    if (!editing) setName(groupName)
  }, [groupName, editing])
  const screensQuery = useQuery({
    queryKey: queryKeys.screens.list(orgId ?? 'none', SCREENS_QUERY),
    queryFn: () => apiFetch<ScreenView[]>(`/api/screens${buildQuery({ sort: SCREENS_QUERY.sort })}`),
    enabled: orgId !== null,
  })

  const screens = useMemo(
    () => (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now)),
    [screensQuery.data, statuses, now],
  )

  const screensMutation = useMutation({
    mutationFn: (screenIds: string[]) =>
      apiFetch<GroupDetailView>(`/api/groups/${id}/screens`, { method: 'PUT', json: { screen_ids: screenIds } }),
    onSuccess: (data) => {
      if (orgId) {
        queryClient.setQueryData(queryKeys.groups.detail(orgId, id), data)
        void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all(orgId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      }
      toast.success('Screens updated')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const renameMutation = useMutation({
    mutationFn: (value: string) =>
      apiFetch<GroupView>(`/api/groups/${id}`, { method: 'PATCH', json: { name: value } }),
    onSuccess: () => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all(orgId) })
      toast.success('Group renamed')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const finishRename = () => {
    setEditing(false)
    if (cancelRef.current) {
      cancelRef.current = false
      setName(groupName)
      return
    }
    const trimmed = name.trim()
    if (!trimmed || trimmed === groupName) {
      setName(groupName)
      return
    }
    renameMutation.mutate(trimmed)
  }

  if (!org) return <NoOrgState />

  if (detailQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  const detail = detailQuery.data
  if (detailQuery.isError || !detail) {
    return (
      <EmptyState
        title="Group not found"
        description="It may have been deleted, or it belongs to another organization."
        action={<Button variant="outline" render={<Link href="/groups" />}>Back to Groups</Button>}
      />
    )
  }

  const count = detail.screens.length
  const banner = (
    <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
      <UsersIcon className="size-4 shrink-0 text-primary" />
      <span>
        This is a group playlist — changes apply to all {count} {count === 1 ? 'screen' : 'screens'} in
        this group.
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Back to groups" render={<Link href="/groups" />}>
          <ArrowLeftIcon />
        </Button>
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                cancelRef.current = true
                e.currentTarget.blur()
              }
            }}
            maxLength={120}
            autoFocus
            aria-label="Group name"
            className="h-9 w-72 text-xl font-semibold tracking-[-0.02em]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="max-w-full cursor-text truncate rounded-md text-left text-2xl leading-[1.05] font-semibold tracking-[-0.02em] outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {detail.name}
          </button>
        )}
        <span className="text-sm text-muted-foreground">
          {count} {count === 1 ? 'screen' : 'screens'}
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PlaylistEditor
          key={detail.playlist.id}
          playlistId={detail.playlist.id}
          initial={detail.playlist}
          banner={banner}
          onSaved={(v: PlaylistView) => {
            if (orgId) {
              queryClient.setQueryData<GroupDetailView>(queryKeys.groups.detail(orgId, id), (prev) =>
                prev ? { ...prev, playlist: v } : prev,
              )
            }
          }}
        />
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <GroupScreensPanel
            group={detail}
            screens={screens}
            onChange={(ids) => screensMutation.mutate(ids)}
            saving={screensMutation.isPending}
          />
        </div>
      </div>
    </div>
  )
}

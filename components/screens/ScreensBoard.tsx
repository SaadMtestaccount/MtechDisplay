'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, TvIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DeleteScreenDialog } from '@/components/screens/DeleteScreenDialog'
import { MoveToGroupDialog } from '@/components/screens/MoveToGroupDialog'
import { PairDialog } from '@/components/screens/PairDialog'
import { RotationDialog } from '@/components/screens/RotationDialog'
import type { ScreenCardAction } from '@/components/screens/ScreenCard'
import { ScreenFilters } from '@/components/screens/ScreenFilters'
import { ScreenGrid } from '@/components/screens/ScreenGrid'
import { EmptyState } from '@/components/shell/EmptyState'
import { ListToolbar } from '@/components/shell/ListToolbar'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { RenameDialog } from '@/components/shell/RenameDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus } from '@/lib/status'
import {
  SCREEN_SORTS,
  type GroupListQuery,
  type GroupView,
  type OkResponse,
  type ScreenAction,
  type ScreenListQuery,
  type ScreenSort,
  type ScreenStatus,
  type ScreenView,
} from '@/types/api'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'last_seen', label: 'Last seen' },
  { value: 'newest', label: 'Newest' },
]

const GROUPS_QUERY: GroupListQuery = { sort: 'name' }

/** /screens page component: list query + realtime merge + ticking clock + all dialogs. */
export function ScreensBoard() {
  const { org } = useApp()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const orgId = org?.id ?? null

  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ScreenSort>('name')
  const [status, setStatus] = useState<ScreenStatus | undefined>(undefined)
  const [groupId, setGroupId] = useState<string | undefined>(undefined)
  const [pairOpen, setPairOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ScreenView | null>(null)
  const [rotationTarget, setRotationTarget] = useState<ScreenView | null>(null)
  const [groupTarget, setGroupTarget] = useState<ScreenView | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScreenView | null>(null)

  const params: ScreenListQuery = { q: q || undefined, sort, status, group_id: groupId }
  const filtered = q !== '' || status !== undefined || groupId !== undefined

  const screensQuery = useQuery({
    queryKey: queryKeys.screens.list(orgId ?? 'none', params),
    queryFn: () =>
      apiFetch<ScreenView[]>(
        `/api/screens${buildQuery({ q: params.q, sort: params.sort, status: params.status, group_id: params.group_id })}`,
      ),
    enabled: orgId !== null,
  })
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(orgId ?? 'none', GROUPS_QUERY),
    queryFn: () => apiFetch<GroupView[]>(`/api/groups${buildQuery({ sort: GROUPS_QUERY.sort })}`),
    enabled: orgId !== null,
  })

  // Realtime merge; re-apply the status filter so live flips keep the list truthful.
  const screens = useMemo(() => {
    const merged = (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now))
    if (status === 'online') return merged.filter((s) => s.online)
    if (status === 'offline') return merged.filter((s) => !s.online)
    return merged
  }, [screensQuery.data, statuses, now, status])

  const ungroup = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ScreenView>(`/api/screens/${id}`, { method: 'PATCH', json: { group_id: null } }),
    onSuccess: () => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      toast.success('Removed from group')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const action = useMutation({
    mutationFn: (input: { id: string; action: ScreenAction }) =>
      apiFetch<OkResponse>(`/api/screens/${input.id}/actions`, { method: 'POST', json: { action: input.action } }),
    onSuccess: (_ok, input) =>
      toast.success(
        input.action === 'identify' ? 'Identify sent — the TV shows its name for a few seconds' : 'Reload sent',
      ),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const handleRename = async (value: string) => {
    if (!renameTarget) return
    try {
      await apiFetch<ScreenView>(`/api/screens/${renameTarget.id}`, { method: 'PATCH', json: { name: value } })
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      toast.success('Screen renamed')
      setRenameTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  if (!org) return <NoOrgState />

  const handleAction = (cardAction: ScreenCardAction, screen: ScreenView) => {
    if (cardAction === 'open') router.push(`/screens/${screen.id}`)
    else if (cardAction === 'rename') setRenameTarget(screen)
    else if (cardAction === 'rotation') setRotationTarget(screen)
    else if (cardAction === 'identify') action.mutate({ id: screen.id, action: 'identify' })
    else if (cardAction === 'reload') action.mutate({ id: screen.id, action: 'reload' })
    else if (cardAction === 'group') setGroupTarget(screen)
    else if (cardAction === 'ungroup') ungroup.mutate(screen.id)
    else setDeleteTarget(screen)
  }

  const clearFilters = () => {
    setQ('')
    setStatus(undefined)
    setGroupId(undefined)
  }

  return (
    <>
      <PageHeader
        title="Screens"
        primary={
          <Button variant="outline" onClick={() => setPairOpen(true)}>
            <PlusIcon />
            Add Screen
          </Button>
        }
      >
        <ListToolbar
          search={q}
          onSearchChange={setQ}
          sort={{
            value: sort,
            options: SORT_OPTIONS,
            onChange: (v) => {
              const match = SCREEN_SORTS.find((s) => s === v)
              if (match) setSort(match)
            },
          }}
          filters={
            <ScreenFilters
              value={params}
              groups={groupsQuery.data ?? []}
              onChange={(next) => {
                setStatus(next.status)
                setGroupId(next.group_id)
              }}
            />
          }
          activeFilterCount={(status !== undefined ? 1 : 0) + (groupId !== undefined ? 1 : 0)}
        />
      </PageHeader>

      {screensQuery.isPending ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : screensQuery.isError ? (
        <EmptyState
          title="Couldn't load screens"
          description={screensQuery.error instanceof Error ? screensQuery.error.message : 'Something went wrong.'}
          action={
            <Button variant="outline" onClick={() => void screensQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : screens.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No screens match"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<TvIcon />}
            title="No screens yet"
            description="Open /player in the TV's browser to show a pairing code, then click Add Screen and enter it."
            action={
              <Button onClick={() => setPairOpen(true)}>
                <PlusIcon />
                Add Screen
              </Button>
            }
          />
        )
      ) : (
        <ScreenGrid screens={screens} now={now} onAction={handleAction} />
      )}

      <PairDialog open={pairOpen} onOpenChange={setPairOpen} />
      <RenameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        title="Rename screen"
        initialValue={renameTarget?.name ?? ''}
        onSubmit={handleRename}
      />
      <RotationDialog
        screen={rotationTarget}
        onOpenChange={(open) => {
          if (!open) setRotationTarget(null)
        }}
      />
      <MoveToGroupDialog
        screen={groupTarget}
        groups={groupsQuery.data ?? []}
        onOpenChange={(open) => {
          if (!open) setGroupTarget(null)
        }}
      />
      <DeleteScreenDialog
        screen={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </>
  )
}

'use client'

/**
 * components/wall/WallBoard.tsx — the Screen Wall (docs/CONTRACTS.md §14). A grid of live TV tiles
 * plus a draggable tray; dropping a menu / board / web page on a tile assigns it live and pins it.
 * One DndContext wraps the tray (draggables) and the tiles (droppables).
 */
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { WallTile } from '@/components/wall/WallTile'
import { WallTray } from '@/components/wall/WallTray'
import { assignBodyFor, screenIdFromDrop, type WallPick } from '@/components/wall/wall-dnd'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus } from '@/lib/status'
import type { AssignScreenInput } from '@/lib/validators/screens'
import type { ScreenView } from '@/types/api'

export function WallBoard() {
  const { org } = useApp()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const [drag, setDrag] = useState<WallPick | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const screensQuery = useQuery({
    queryKey: org ? queryKeys.screens.list(org.id, { sort: 'name' }) : ['screens', 'none'],
    queryFn: () => apiFetch<ScreenView[]>('/api/screens?sort=name'),
    enabled: org !== null,
  })

  const invalidate = () => {
    if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
  }

  const assign = useMutation({
    mutationFn: ({ screenId, body }: { screenId: string; body: AssignScreenInput }) =>
      apiFetch<ScreenView>(`/api/screens/${screenId}/assign`, { method: 'POST', json: body }),
    onSuccess: (screen, { body }) => {
      invalidate()
      toast.success(body.kind === 'clear' ? `Cleared ${screen.name}` : `Now showing on ${screen.name}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const lock = useMutation({
    mutationFn: ({ screenId, locked }: { screenId: string; locked: boolean }) =>
      apiFetch<ScreenView>(`/api/screens/${screenId}`, { method: 'PATCH', json: { locked } }),
    onSuccess: (screen) => {
      invalidate()
      toast.success(screen.locked ? `Locked ${screen.name}` : `Unlocked ${screen.name}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  if (!org) return <NoOrgState />

  const screens = (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now))

  const onDragStart = (e: DragStartEvent) => setDrag((e.active.data.current?.pick as WallPick | undefined) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setDrag(null)
    const pick = e.active.data.current?.pick as WallPick | undefined
    const screenId = screenIdFromDrop(e.over ? String(e.over.id) : null)
    if (!pick || !screenId || assign.isPending) return
    assign.mutate({ screenId, body: assignBodyFor(pick) })
  }

  return (
    <>
      <PageHeader
        title="Wall"
        description="Drag a menu, board or web page onto a TV to show it. It locks on — unlock the TV to change it."
      />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="lg:order-2 lg:w-72 lg:shrink-0">
            <WallTray orgId={org.id} />
          </div>
          <div className="min-w-0 flex-1 lg:order-1">
            {screensQuery.isPending ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video w-full rounded-lg" />
                ))}
              </div>
            ) : screensQuery.isError ? (
              <p className="text-sm text-destructive">Could not load screens.</p>
            ) : screens.length === 0 ? (
              <EmptyState title="No screens yet" description="Pair a TV, then drag a menu onto it here." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {screens.map((s) => (
                  <WallTile
                    key={s.id}
                    screen={s}
                    onOpen={() => router.push(`/screens/${s.id}`)}
                    onToggleLock={() => lock.mutate({ screenId: s.id, locked: !s.locked })}
                    onClear={() => assign.mutate({ screenId: s.id, body: { kind: 'clear' } })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {drag ? (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-lg">
              {drag.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}

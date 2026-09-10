'use client'

/**
 * components/wall/WallBoard.tsx — the Screen Wall (docs/CONTRACTS.md §14). A grid of live TV tiles
 * plus a draggable tray; dropping a menu / board / web page on a tile assigns it live and pins it.
 * One DndContext wraps the tray (draggables) and the tiles (droppables). "Select TVs" enters a
 * selection mode where tiles act as checkboxes and the toolbar syncs / unsyncs them together (§21).
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
import { CheckSquareIcon, MegaphoneIcon, PlusIcon, RadioIcon, RefreshCwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { DeleteScreenDialog } from '@/components/screens/DeleteScreenDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AddTvDialog } from '@/components/wall/AddTvDialog'
import { ScreenCodeDialog } from '@/components/wall/ScreenCodeDialog'
import { WallTile } from '@/components/wall/WallTile'
import { WallTray } from '@/components/wall/WallTray'
import { WatermarkPositionDialog } from '@/components/wall/WatermarkPositionDialog'
import { assignBodyFor, screenIdFromDrop, type WallPick } from '@/components/wall/wall-dnd'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus } from '@/lib/status'
import type { AssignScreenInput } from '@/lib/validators/screens'
import type { OkResponse, ScreenAction, ScreenView } from '@/types/api'

export function WallBoard() {
  const { org, profile } = useApp()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const [drag, setDrag] = useState<WallPick | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [codeTarget, setCodeTarget] = useState<ScreenView | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScreenView | null>(null)
  const [watermarkTarget, setWatermarkTarget] = useState<ScreenView | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const screensQuery = useQuery({
    queryKey: org ? queryKeys.screens.list(org.id, { sort: 'name' }) : ['screens', 'none'],
    queryFn: () => apiFetch<ScreenView[]>('/api/screens?sort=name'),
    enabled: org !== null,
  })

  const invalidate = () => {
    if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
  }
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong')

  const assign = useMutation({
    mutationFn: ({ screenId, body }: { screenId: string; body: AssignScreenInput }) =>
      apiFetch<ScreenView>(`/api/screens/${screenId}/assign`, { method: 'POST', json: body }),
    onSuccess: (screen, { body }) => {
      invalidate()
      toast.success(body.kind === 'clear' ? `Cleared ${screen.name}` : `Now showing on ${screen.name}`)
    },
    onError: fail,
  })

  const lock = useMutation({
    mutationFn: ({ screenId, locked }: { screenId: string; locked: boolean }) =>
      apiFetch<ScreenView>(`/api/screens/${screenId}`, { method: 'PATCH', json: { locked } }),
    onSuccess: (screen) => {
      invalidate()
      toast.success(screen.locked ? `Locked ${screen.name}` : `Unlocked ${screen.name}`)
    },
    onError: fail,
  })

  /** One call for the whole selection so every TV gets the SAME starting line (0:00 together, §21). */
  const syncMany = useMutation({
    mutationFn: ({ ids, sync }: { ids: string[]; sync: boolean }) =>
      apiFetch<{ updated: number }>('/api/screens/sync', { method: 'POST', json: { ids, sync } }),
    onSuccess: ({ updated }, { sync }) => {
      invalidate()
      toast.success(
        sync
          ? `${updated} ${updated === 1 ? 'TV' : 'TVs'} now play in sync from the start`
          : `Sync turned off for ${updated} ${updated === 1 ? 'TV' : 'TVs'}`,
      )
    },
    onError: (e) => {
      invalidate()
      fail(e)
    },
  })

  /** Identify / reload every selected TV (one action call per TV; unpaired TVs are skipped). */
  const actMany = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: ScreenAction }) => {
      await Promise.all(
        ids.map((id) => apiFetch<OkResponse>(`/api/screens/${id}/actions`, { method: 'POST', json: { action } })),
      )
      return { count: ids.length, action }
    },
    onSuccess: ({ count, action }) =>
      toast.success(
        action === 'identify'
          ? `Identify sent to ${count} ${count === 1 ? 'TV' : 'TVs'} — each shows its name for a few seconds`
          : `Reload sent to ${count} ${count === 1 ? 'TV' : 'TVs'}`,
      ),
    onError: fail,
  })

  if (!org) return <NoOrgState />

  const screens = (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now))
  const selectedIds = screens.filter((s) => selected.has(s.id)).map((s) => s.id)
  // Identify/reload only reach paired TVs (the command rides the device channel).
  const selectedPairedIds = screens.filter((s) => selected.has(s.id) && s.paired).map((s) => s.id)
  const busy = syncMany.isPending || actMany.isPending

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const exitSelection = () => {
    setSelecting(false)
    setSelected(new Set())
  }

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
        title="TVs"
        description="Every TV in your store. Click a TV to watch it full screen. Drag a menu, image or web page onto one to show it — it locks on. Select TVs to make them play in sync."
        primary={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add TV
          </Button>
        }
      >
        {selecting ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="selection-toolbar">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button
              size="sm"
              disabled={selectedIds.length === 0 || busy}
              onClick={() => syncMany.mutate({ ids: selectedIds, sync: true })}
            >
              <RadioIcon /> Sync selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0 || busy}
              onClick={() => syncMany.mutate({ ids: selectedIds, sync: false })}
            >
              Unsync selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedPairedIds.length === 0 || busy}
              title={selectedPairedIds.length === 0 && selectedIds.length > 0 ? 'None of the selected TVs is signed in' : undefined}
              onClick={() => actMany.mutate({ ids: selectedPairedIds, action: 'identify' })}
            >
              <MegaphoneIcon /> Identify selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedPairedIds.length === 0 || busy}
              onClick={() => actMany.mutate({ ids: selectedPairedIds, action: 'reload' })}
            >
              <RefreshCwIcon /> Reload selected
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelection} disabled={busy}>
              Done
            </Button>
          </div>
        ) : screens.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setSelecting(true)}>
            <CheckSquareIcon /> Select TVs
          </Button>
        ) : null}
      </PageHeader>
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
              <EmptyState
                icon={<PlusIcon />}
                title="No TVs yet"
                description="Add a TV to get a code, type it on the screen, then drag a menu onto it here."
                action={
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <PlusIcon /> Add TV
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {screens.map((s) => (
                  <WallTile
                    key={s.id}
                    screen={s}
                    onOpen={() => router.push(`/screens/${s.id}`)}
                    onShowCode={() => setCodeTarget(s)}
                    onToggleLock={() => lock.mutate({ screenId: s.id, locked: !s.locked })}
                    onToggleSync={() => syncMany.mutate({ ids: [s.id], sync: !s.sync })}
                    onClear={() => assign.mutate({ screenId: s.id, body: { kind: 'clear' } })}
                    onDelete={() => setDeleteTarget(s)}
                    onPositionWatermark={profile.is_super_admin ? () => setWatermarkTarget(s) : undefined}
                    selectable={selecting}
                    selected={selected.has(s.id)}
                    onToggleSelect={() => toggleSelect(s.id)}
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

      <AddTvDialog open={addOpen} onOpenChange={setAddOpen} onCreated={(s) => setCodeTarget(s)} />
      <ScreenCodeDialog
        screen={codeTarget}
        onOpenChange={(open) => {
          if (!open) setCodeTarget(null)
        }}
      />
      <DeleteScreenDialog
        screen={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
      <WatermarkPositionDialog
        screen={watermarkTarget}
        onOpenChange={(open) => {
          if (!open) setWatermarkTarget(null)
        }}
      />
    </>
  )
}

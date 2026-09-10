'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { EmptyPlaylist } from '@/components/playlist/EmptyPlaylist'
import { LibraryPanel } from '@/components/playlist/LibraryPanel'
import { PlaylistDropPane } from '@/components/playlist/PlaylistDropPane'
import { PlaylistRow } from '@/components/playlist/PlaylistRow'
import { SaveStatus } from '@/components/playlist/SaveStatus'
import { newItemFromPick, type LibraryPick } from '@/components/playlist/playlist-utils'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/hooks/useApp'
import { usePlaylistAutosave } from '@/hooks/usePlaylistAutosave'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { PlaylistItemInput } from '@/lib/validators/playlists'
import type { PlaylistView } from '@/types/api'

type DragState = { kind: 'lib'; pick: LibraryPick } | { kind: 'row'; id: string } | null

function pickFromEvent(e: DragStartEvent | DragEndEvent): LibraryPick | null {
  const data = e.active.data.current as { pick?: LibraryPick } | undefined
  return data?.pick ?? null
}

/**
 * Two-pane playlist editor with ONE DndContext (docs/CONTRACTS.md §9.5): library cards are
 * draggable (`lib:{kind}:{id}`), the right pane is droppable (`playlist-drop`), rows sort
 * vertically (`row:{item_id}`). Drop from library → append; row reorder → arrayMove. Owns
 * the usePlaylistAutosave instance and flushes it on unmount (acceptance #5).
 */
export function PlaylistEditor({
  playlistId,
  initial,
  banner,
  onSaved,
}: {
  playlistId: string
  initial: PlaylistView
  banner?: ReactNode
  onSaved?(v: PlaylistView): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const orgId = org?.id ?? null
  const [drag, setDrag] = useState<DragState>(null)

  const handleSaved = useCallback(
    (view: PlaylistView) => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all(orgId) })
      onSaved?.(view)
    },
    [onSaved, orgId, queryClient],
  )

  const { items, setItems, status, flush, lastSavedAt } = usePlaylistAutosave({
    playlistId,
    initialItems: initial.items,
    onSaved: handleSaved,
  })

  // Synchronized playback (§21): every TV on this playlist follows the shared clock.
  const [sync, setSync] = useState(initial.sync)
  const syncMutation = useMutation({
    mutationFn: (next: boolean) =>
      apiFetch<PlaylistView>(`/api/playlists/${playlistId}`, { method: 'PATCH', json: { sync: next } }),
    onMutate: (next) => setSync(next),
    onSuccess: (view) => {
      setSync(view.sync)
      handleSaved(view)
      toast.success(view.sync ? 'TVs on this playlist now play in sync' : 'Sync turned off')
    },
    onError: (e, next) => {
      setSync(!next)
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    },
  })

  // In-app <Link> navigation within the 500 ms debounce must not lose an edit: flush (with
  // keepalive) on unmount. `flush` is stable, so this cleanup runs exactly once.
  useEffect(() => () => void flush(), [flush])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Row drags pick the nearest ROW (the pane would swallow drops in the gaps); library
  // drags need the pointer inside the pane — no fallback, or dropping anywhere would append.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (String(args.active.id).startsWith('row:')) {
      const rows = args.droppableContainers.filter((c) => String(c.id).startsWith('row:'))
      return closestCenter({ ...args, droppableContainers: rows })
    }
    return pointerWithin(args)
  }, [])

  const append = useCallback(
    (pick: LibraryPick) => {
      setItems((prev) => [...prev, newItemFromPick(pick, playlistId, prev.length)])
    },
    [playlistId, setItems],
  )
  const patchItem = useCallback(
    (id: string, patch: Partial<PlaylistItemInput>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    },
    [setItems],
  )
  const removeItem = useCallback(
    (id: string) => setItems((prev) => prev.filter((i) => i.id !== id)),
    [setItems],
  )

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith('lib:')) {
      const pick = pickFromEvent(e)
      setDrag(pick ? { kind: 'lib', pick } : null)
    } else if (id.startsWith('row:')) {
      setDrag({ kind: 'row', id: id.slice(4) })
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDrag(null)
    const activeId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (activeId.startsWith('lib:')) {
      if (overId !== 'playlist-drop' && !overId?.startsWith('row:')) return
      const pick = pickFromEvent(e)
      if (pick) append(pick)
      return
    }
    if (!overId?.startsWith('row:') || overId === activeId) return
    setItems((prev) => {
      const from = prev.findIndex((i) => `row:${i.id}` === activeId)
      const to = prev.findIndex((i) => `row:${i.id}` === overId)
      return from < 0 || to < 0 || from === to ? prev : arrayMove(prev, from, to)
    })
  }

  const rowIds = useMemo(() => items.map((i) => `row:${i.id}`), [items])
  const dragName =
    drag?.kind === 'lib'
      ? drag.pick.kind === 'content'
        ? drag.pick.content.name
        : drag.pick.website.name
      : drag
        ? (items.find((i) => i.id === drag.id)?.name ?? 'Item')
        : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {banner}
        <div className="flex min-w-0 flex-col items-stretch gap-6 md:flex-row md:items-start">
          {orgId ? <LibraryPanel orgId={orgId} onAdd={append} /> : null}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base leading-[1.05] font-semibold tracking-[-0.02em]">Playlist</h2>
                <span className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Label
                  htmlFor={`sync-${playlistId}`}
                  className="flex cursor-pointer items-center gap-2 text-sm font-normal text-muted-foreground"
                  title="Every TV showing this playlist plays the same item at the same moment — videos included"
                >
                  <Switch
                    id={`sync-${playlistId}`}
                    size="sm"
                    checked={sync}
                    onCheckedChange={(next) => {
                      if (!syncMutation.isPending) syncMutation.mutate(next)
                    }}
                    disabled={syncMutation.isPending}
                    aria-label="Sync playback across TVs"
                  />
                  Sync across TVs
                </Label>
                <SaveStatus status={status} lastSavedAt={lastSavedAt} />
              </div>
            </div>
            <PlaylistDropPane highlight={drag?.kind === 'lib'}>
              {items.length === 0 ? (
                <EmptyPlaylist />
              ) : (
                <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <PlaylistRow
                        key={item.id}
                        item={item}
                        onChange={(patch) => patchItem(item.id, patch)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </PlaylistDropPane>
          </div>
        </div>
      </div>
      <DragOverlay>
        {dragName !== null ? (
          <div className="pointer-events-none w-56 truncate rounded-lg bg-card px-3 py-2 text-sm font-medium shadow-lg ring-1 ring-primary/50">
            {dragName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

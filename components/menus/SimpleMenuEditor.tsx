'use client'

/**
 * components/menus/SimpleMenuEditor.tsx — the merchant menu editor (docs/CONTRACTS.md §23):
 * a numbered list with up/down arrows and a seconds stepper, "Add photos or videos" (multi-pick
 * dialog), and the "Which TVs" card. Persists through the same usePlaylistAutosave as the
 * advanced editor (500 ms debounce, full list PUT, flush on unmount).
 */
import { useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AddItemsDialog } from '@/components/menus/AddItemsDialog'
import { MenuItemRow } from '@/components/menus/MenuItemRow'
import { MenuScreensCard } from '@/components/menus/MenuScreensCard'
import { SaveStatus } from '@/components/playlist/SaveStatus'
import { newItemFromPick, type LibraryPick } from '@/components/playlist/playlist-utils'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'
import { usePlaylistAutosave } from '@/hooks/usePlaylistAutosave'
import { queryKeys } from '@/lib/query-keys'
import type { PlaylistView } from '@/types/api'

export function SimpleMenuEditor({ menu }: { menu: PlaylistView }) {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  const handleSaved = useCallback(
    (view: PlaylistView) => {
      if (!orgId) return
      queryClient.setQueryData<PlaylistView>(queryKeys.menus.detail(orgId, menu.id), (prev) => (prev ? { ...prev, items: view.items } : view))
      void queryClient.invalidateQueries({ queryKey: queryKeys.menus.list(orgId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
    },
    [menu.id, orgId, queryClient],
  )

  const { items, setItems, status, flush, lastSavedAt } = usePlaylistAutosave({
    playlistId: menu.id,
    initialItems: menu.items,
    onSaved: handleSaved,
  })
  useEffect(() => () => void flush(), [flush])

  const move = (index: number, direction: -1 | 1) =>
    setItems((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = prev.slice()
      const [row] = next.splice(index, 1)
      if (!row) return prev
      next.splice(target, 0, row)
      return next.map((item, position) => ({ ...item, position }))
    })

  const add = (picks: LibraryPick[]) =>
    setItems((prev) => [...prev, ...picks.map((pick, i) => newItemFromPick(pick, menu.id, prev.length + i))])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="order-2 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:order-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">What plays, in order</h2>
          <span className="text-sm text-muted-foreground">Use the arrows to move a photo up or down.</span>
          <span className="ml-auto">
            <SaveStatus status={status} lastSavedAt={lastSavedAt} />
          </span>
        </div>
        {items.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-4 text-center text-[15px] text-muted-foreground">
            This menu is empty. Add some photos or videos and they play one after another.
          </p>
        ) : (
          items.map((item, i) => (
            <MenuItemRow
              key={item.id}
              item={item}
              index={i}
              count={items.length}
              onDuration={(seconds) =>
                setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, duration_seconds: seconds } : row)))
              }
              onMove={(direction) => move(i, direction)}
              onRemove={() => setItems((prev) => prev.filter((row) => row.id !== item.id).map((row, position) => ({ ...row, position })))}
            />
          ))
        )}
        <Button size="xl" variant="outline" className="border-2 border-dashed border-primary/60 text-primary" onClick={() => setAdding(true)}>
          <PlusIcon /> Add photos or videos to this menu
        </Button>
      </div>
      <div className="order-1 lg:order-2">
        <MenuScreensCard menu={menu} />
      </div>
      <AddItemsDialog open={adding} onOpenChange={setAdding} onAdd={add} />
    </div>
  )
}

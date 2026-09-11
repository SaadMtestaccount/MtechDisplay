'use client'

/** components/menus/MenusPage.tsx — the menu library (docs/CONTRACTS.md §23): big cards, one sentence, New menu. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { MenuCard } from '@/components/menus/MenuCard'
import { MenuDialog } from '@/components/menus/MenuDialog'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { MenuView, OkResponse } from '@/types/api'

const GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export function MenusPage() {
  const { org } = useApp()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<MenuView | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MenuView | null>(null)

  const menusQuery = useQuery({
    queryKey: queryKeys.menus.list(org?.id ?? ''),
    queryFn: () => apiFetch<MenuView[]>('/api/menus'),
    enabled: org !== null,
  })

  const deleteMutation = useMutation({
    mutationFn: (menu: MenuView) => apiFetch<OkResponse>(`/api/menus/${menu.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (org) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all(org.id) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      }
      toast.success('Menu deleted')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  if (!org) return <NoOrgState />

  const newCard = (
    <button
      type="button"
      onClick={() => setCreateOpen(true)}
      className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-center text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
    >
      <PlusIcon className="size-8 text-primary" />
      <span className="text-[15px] font-semibold">Make a new menu from your photos</span>
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-[30px] font-extrabold tracking-[-0.03em]">Menus</h1>
          <p className="max-w-2xl text-[15px] text-muted-foreground">
            A menu is a set of photos or videos that play one after another. Tap one to change it or put it on a TV.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreateOpen(true)}>
          <PlusIcon /> New menu
        </Button>
      </div>

      {menusQuery.isPending ? (
        <div className={GRID}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : menusQuery.isError ? (
        <p className="text-sm text-destructive">Could not load menus.</p>
      ) : (
        <div className={GRID}>
          {menusQuery.data.map((menu) => (
            <MenuCard
              key={menu.id}
              menu={menu}
              onOpen={() => router.push(`/menus/${menu.id}`)}
              onRename={() => setRenameTarget(menu)}
              onDelete={() => setDeleteTarget(menu)}
            />
          ))}
          {newCard}
        </div>
      )}

      <MenuDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MenuDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        menu={renameTarget ?? undefined}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : 'Delete menu'}
        description={
          deleteTarget && deleteTarget.screen_count > 0
            ? `${deleteTarget.screen_count} ${deleteTarget.screen_count === 1 ? 'TV is' : 'TVs are'} showing this menu. They will show nothing until you pick something else for them.`
            : 'This cannot be undone. Your photos and videos stay in Photos.'
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget && !deleteMutation.isPending) deleteMutation.mutate(deleteTarget)
        }}
      />
    </div>
  )
}

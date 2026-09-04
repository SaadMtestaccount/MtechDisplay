'use client'

/** components/menus/MenusPage.tsx — the menu library: create, rename, delete; a card opens its editor. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { MenuCard } from '@/components/menus/MenuCard'
import { MenuDialog } from '@/components/menus/MenuDialog'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { MenuView, OkResponse } from '@/types/api'

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
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all(org.id) })
      toast.success('Menu deleted')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  if (!org) return <NoOrgState />

  return (
    <>
      <PageHeader
        title="Menus"
        description="Reusable sets of boards. Build one here, then drag it onto any TV from the Wall."
        primary={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon /> New menu
          </Button>
        }
      />

      {menusQuery.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : menusQuery.isError ? (
        <p className="text-sm text-destructive">Could not load menus.</p>
      ) : menusQuery.data.length === 0 ? (
        <EmptyState
          icon={<PlusIcon />}
          title="No menus yet"
          description="Create a menu, add boards to it, then drag it onto your TVs from the Wall."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon /> New menu
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {menusQuery.data.map((menu) => (
            <MenuCard
              key={menu.id}
              menu={menu}
              onOpen={() => router.push(`/menus/${menu.id}`)}
              onRename={() => setRenameTarget(menu)}
              onDelete={() => setDeleteTarget(menu)}
            />
          ))}
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
            ? `${deleteTarget.screen_count} screen${deleteTarget.screen_count === 1 ? '' : 's'} showing this menu will go back to their own content.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget && !deleteMutation.isPending) deleteMutation.mutate(deleteTarget)
        }}
      />
    </>
  )
}

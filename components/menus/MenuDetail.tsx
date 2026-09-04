'use client'

/** components/menus/MenuDetail.tsx — edit a menu's boards with the shared PlaylistEditor. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { PlaylistView } from '@/types/api'

export function MenuDetail({ id }: { id: string }) {
  const { org } = useApp()
  const queryClient = useQueryClient()

  const menuQuery = useQuery({
    queryKey: queryKeys.menus.detail(org?.id ?? '', id),
    queryFn: () => apiFetch<PlaylistView>(`/api/menus/${id}`),
    enabled: org !== null,
  })

  if (!org) return <NoOrgState />

  if (menuQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }
  if (menuQuery.isError || !menuQuery.data) {
    return <p className="text-sm text-destructive">Could not load this menu.</p>
  }

  const menu = menuQuery.data
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/menus"
          aria-label="Back to menus"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <h1 className="text-xl font-semibold">{menu.name}</h1>
        <span className="eyebrow">Menu</span>
      </div>
      <PlaylistEditor
        playlistId={id}
        initial={menu}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all(org.id) })
        }}
      />
    </div>
  )
}

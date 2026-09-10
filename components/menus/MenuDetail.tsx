'use client'

/**
 * components/menus/MenuDetail.tsx — /menus/[id] (docs/CONTRACTS.md §23): header (back, name,
 * "on N TVs" pill, Rename) + SimpleMenuEditor. MTech staff can open the advanced editor
 * (schedules, transitions, mute) with ?advanced=1.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, PencilIcon, SlidersHorizontalIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { MenuDialog } from '@/components/menus/MenuDialog'
import { SimpleMenuEditor } from '@/components/menus/SimpleMenuEditor'
import { PlaylistEditor } from '@/components/playlist/PlaylistEditor'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { MenuView, PlaylistView } from '@/types/api'

export function MenuDetail({ id, advanced = false }: { id: string; advanced?: boolean }) {
  const { org, profile } = useApp()
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)

  const menuQuery = useQuery({
    queryKey: queryKeys.menus.detail(org?.id ?? '', id),
    queryFn: () => apiFetch<PlaylistView>(`/api/menus/${id}`),
    enabled: org !== null,
  })
  const menusQuery = useQuery({
    queryKey: queryKeys.menus.list(org?.id ?? ''),
    queryFn: () => apiFetch<MenuView[]>('/api/menus'),
    enabled: org !== null,
  })

  if (!org) return <NoOrgState />

  if (menuQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  if (menuQuery.isError || !menuQuery.data) {
    return (
      <EmptyState
        title="Menu not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" render={<Link href="/menus" />}>
            Back to menus
          </Button>
        }
      />
    )
  }

  const menu = menuQuery.data
  const summary = menusQuery.data?.find((m) => m.id === id) ?? null
  const onCount = summary?.screen_count ?? 0
  const showAdvanced = advanced && profile.is_super_admin

  return (
    <div className="flex flex-col gap-5">
      <Link href="/menus" className="inline-flex w-fit items-center gap-1 text-[15px] font-semibold text-primary hover:underline">
        <ArrowLeftIcon className="size-4" /> All menus
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate text-3xl font-extrabold tracking-tight">{menu.name}</h1>
        <span
          className={
            onCount > 0
              ? 'rounded-full bg-online-soft px-3 py-1 text-sm font-semibold text-online'
              : 'rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground'
          }
        >
          {onCount > 0 ? `Showing on ${onCount} ${onCount === 1 ? 'TV' : 'TVs'}` : 'Not on a TV yet'}
        </span>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setRenaming(true)}>
          <PencilIcon /> Rename
        </Button>
        {profile.is_super_admin ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            render={<Link href={showAdvanced ? `/menus/${id}` : `/menus/${id}?advanced=1`} />}
          >
            <SlidersHorizontalIcon /> {showAdvanced ? 'Simple editor' : 'Advanced editor'}
          </Button>
        ) : null}
      </div>

      {showAdvanced ? (
        <PlaylistEditor
          key={menu.id}
          playlistId={id}
          initial={menu}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all(org.id) })
          }}
        />
      ) : (
        <SimpleMenuEditor key={menu.id} menu={menu} />
      )}

      <MenuDialog
        open={renaming}
        onOpenChange={setRenaming}
        menu={summary ?? { ...menu, item_count: menu.items.length, screen_count: onCount, thumb_url: null }}
      />
    </div>
  )
}

'use client'

/**
 * components/tvs/TvPage.tsx — /tvs/[id] (docs/CONTRACTS.md §23): the TV is the remote. Big
 * live preview + "Now showing" on the left; the three "Show a…" buttons and TvTools on the
 * right (stacked on phones). Every change goes through ShowPicker → useAssignScreen.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, GlobeIcon, ImageIcon, ListIcon, PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { WebsiteThumb } from '@/components/playlist/WebsiteThumb'
import { TvFrame } from '@/components/screens/TvFrame'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { RenameDialog } from '@/components/shell/RenameDialog'
import { StatusPill } from '@/components/shell/StatusPill'
import { OfflineHelpDialog } from '@/components/tvs/OfflineHelpDialog'
import { ShowPicker, type ShowKind } from '@/components/tvs/ShowPicker'
import { tvShowing } from '@/components/tvs/tv-copy'
import { TvTools } from '@/components/tvs/TvTools'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus, screenStatus } from '@/lib/status'
import { formatLoginCode, relativeTime } from '@/lib/utils'
import { DEFAULT_ITEM_DURATION_SECONDS, type PlaylistItemView, type PlaylistView, type ScreenDetailView, type ScreenView } from '@/types/api'

export function TvPage({ id }: { id: string }) {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const [picker, setPicker] = useState<ShowKind | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: queryKeys.screens.detail(orgId ?? 'none', id),
    queryFn: () => apiFetch<ScreenDetailView>(`/api/screens/${id}`),
    enabled: orgId !== null,
  })
  const menuId = detailQuery.data?.menu_id ?? null
  const menuQuery = useQuery({
    queryKey: queryKeys.menus.detail(orgId ?? 'none', menuId ?? 'none'),
    queryFn: () => apiFetch<PlaylistView>(`/api/menus/${menuId}`),
    enabled: orgId !== null && menuId !== null,
  })

  const rename = useMutation({
    mutationFn: (name: string) => apiFetch<ScreenView>(`/api/screens/${id}`, { method: 'PATCH', json: { name } }),
    onSuccess: () => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      toast.success('TV renamed')
      setRenaming(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  if (!org) return <NoOrgState />

  if (detailQuery.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }
  const detail = detailQuery.data
  if (detailQuery.isError || !detail) {
    return (
      <EmptyState
        title="TV not found"
        description="It may have been removed, or it belongs to another location."
        action={
          <Button variant="outline" render={<Link href="/tvs" />}>
            Back to your TVs
          </Button>
        }
      />
    )
  }

  const screen: ScreenDetailView = { ...detail, ...mergeScreenStatus(detail, statuses[detail.id], now) }
  const status = screenStatus(screen)
  const showing = tvShowing(screen)
  const items: PlaylistItemView[] = screen.menu_id ? (menuQuery.data?.items ?? []) : (screen.playlist?.items ?? [])
  const playingId = screen.current_item?.id ?? null

  return (
    <div className="flex flex-col gap-5">
      <Link href="/tvs" className="inline-flex w-fit items-center gap-1 text-[15px] font-semibold text-primary hover:underline">
        <ArrowLeftIcon className="size-4" /> All TVs
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate text-3xl font-extrabold tracking-tight">{screen.name}</h1>
        <StatusPill status={status} size="md" />
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setRenaming(true)}>
          <PencilIcon /> Rename
        </Button>
        <span className="basis-full text-[15px] text-muted-foreground sm:ml-auto sm:basis-auto">
          {status === 'unpaired'
            ? `Not signed in yet · code ${formatLoginCode(screen.login_code)}`
            : status === 'offline'
              ? `Last seen ${relativeTime(screen.last_seen_at, now)}`
              : org.name}
        </span>
      </div>

      {status === 'offline' ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-offline/30 bg-offline-soft p-4 text-offline sm:flex-row sm:items-center">
          <span className="flex-1 text-[15px] font-semibold">This TV is off. What you pick here plays as soon as it comes back.</span>
          <Button variant="outline" size="lg" className="border-offline/40 text-offline" onClick={() => setHelpOpen(true)}>
            How to fix this
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <TvFrame
              thumbUrl={screen.current_item?.thumb_url ?? screen.preview_thumb_url}
              status={status}
              rotation={screen.rotation}
              orientation={screen.orientation}
              websiteUrl={screen.current_item?.website_url ?? screen.preview_website_url}
            >
              {status === 'online' ? (
                <span className="absolute top-2 left-2 z-10 rounded-full bg-offline px-2.5 py-0.5 text-[11px] font-extrabold tracking-widest text-white">
                  LIVE
                </span>
              ) : null}
            </TvFrame>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">
                {showing.kind === 'nothing' ? 'Showing nothing yet' : `Now showing: ${showing.name}`}
              </h2>
              {items.length > 0 ? (
                <span className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? 'thing' : 'things'}, one after another
                </span>
              ) : null}
              {screen.menu_id ? (
                <Link href={`/menus/${screen.menu_id}`} className="ml-auto text-sm font-semibold text-primary hover:underline">
                  Edit this menu
                </Link>
              ) : null}
            </div>
            {items.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Pick something with the buttons on the right.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {items.map((item, i) => (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <div
                      className={`aspect-video overflow-hidden rounded-lg bg-muted ${playingId === item.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
                    >
                      {item.media_type === 'website' ? (
                        <WebsiteThumb url={item.website_url} />
                      ) : item.thumb_url ? (
                        <img src={item.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="size-5" />
                        </div>
                      )}
                    </div>
                    <div className="truncate text-sm font-semibold">
                      {i + 1} · {item.name}
                      {playingId === item.id ? <span className="text-primary"> (playing)</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.media_type === 'video'
                        ? 'Plays to the end'
                        : `${item.duration_seconds ?? DEFAULT_ITEM_DURATION_SECONDS} seconds`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-bold">Show something else</h2>
            <Button size="xl" className="justify-start" onClick={() => setPicker('menu')}>
              <ListIcon /> Show a menu
            </Button>
            <Button size="xl" variant="outline" className="justify-start border-2" onClick={() => setPicker('content')}>
              <ImageIcon className="text-primary" /> Show a photo or video
            </Button>
            <Button size="xl" variant="outline" className="justify-start border-2" onClick={() => setPicker('website')}>
              <GlobeIcon className="text-primary" /> Show a web page
            </Button>
            <p className="text-sm text-muted-foreground">The TV changes within a few seconds.</p>
          </div>
          <TvTools screen={screen} />
        </div>
      </div>

      <ShowPicker
        screen={picker ? screen : null}
        kind={picker}
        onOpenChange={(open) => {
          if (!open) setPicker(null)
        }}
      />
      <RenameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename this TV"
        initialValue={screen.name}
        onSubmit={async (value) => {
          await rename.mutateAsync(value)
        }}
      />
      <OfflineHelpDialog screen={helpOpen ? screen : null} onOpenChange={setHelpOpen} />
    </div>
  )
}

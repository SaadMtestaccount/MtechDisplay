'use client'

/**
 * components/tvs/TvsPage.tsx — /tvs for the merchant console (docs/CONTRACTS.md §23). Big TV
 * cards with ONE button each; "Select TVs" turns the cards into checkboxes for the group
 * actions (play in sync / stop sync / flash names / restart). No drag-and-drop anywhere —
 * what a TV shows is changed on its own page (/tvs/[id]).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquareIcon, CircleHelpIcon, MegaphoneIcon, PlusIcon, RadioIcon, RefreshCwIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { OfflineHelpDialog } from '@/components/tvs/OfflineHelpDialog'
import { TvCard } from '@/components/tvs/TvCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AddTvDialog } from '@/components/wall/AddTvDialog'
import { ScreenCodeDialog } from '@/components/wall/ScreenCodeDialog'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus } from '@/lib/status'
import { SUPPORT_EMAIL, SUPPORT_PHONE, supportPhoneHref } from '@/lib/support'
import type { OkResponse, ScreenAction, ScreenView } from '@/types/api'

const GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3'

export function TvsPage() {
  const { org } = useApp()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const [addOpen, setAddOpen] = useState(false)
  const [codeTarget, setCodeTarget] = useState<ScreenView | null>(null)
  const [helpTarget, setHelpTarget] = useState<ScreenView | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const screensQuery = useQuery({
    queryKey: org ? queryKeys.screens.list(org.id, { sort: 'name' }) : ['screens', 'none'],
    queryFn: () => apiFetch<ScreenView[]>('/api/screens?sort=name'),
    enabled: org !== null,
  })

  const invalidate = () => {
    if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
  }
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong')

  /** One call for the whole selection so every TV gets the SAME starting line (§21). */
  const syncMany = useMutation({
    mutationFn: ({ ids, sync }: { ids: string[]; sync: boolean }) =>
      apiFetch<{ updated: number }>('/api/screens/sync', { method: 'POST', json: { ids, sync } }),
    onSuccess: ({ updated }, { sync }) => {
      invalidate()
      toast.success(
        sync
          ? `${updated} ${updated === 1 ? 'TV' : 'TVs'} now play together from the start`
          : `${updated} ${updated === 1 ? 'TV' : 'TVs'} back to playing on their own`,
      )
    },
    onError: (e) => {
      invalidate()
      fail(e)
    },
  })

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
          ? `${count} ${count === 1 ? 'TV shows' : 'TVs show'} their name for a few seconds`
          : `Restarting ${count} ${count === 1 ? 'TV' : 'TVs'}`,
      ),
    onError: fail,
  })

  if (!org) return <NoOrgState />

  const screens = (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now))
  const onCount = screens.filter((s) => s.online).length
  const selectedIds = screens.filter((s) => selected.has(s.id)).map((s) => s.id)
  const selectedPairedIds = screens.filter((s) => selected.has(s.id) && s.paired).map((s) => s.id)
  const busy = syncMany.isPending || actMany.isPending
  const tel = supportPhoneHref()

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Your TVs</h1>
          <p className="text-base text-muted-foreground">
            {screensQuery.isPending
              ? 'Loading…'
              : screens.length === 0
                ? `No TVs at ${org.name} yet`
                : `${screens.length} ${screens.length === 1 ? 'TV' : 'TVs'} at ${org.name} · ${onCount} on right now`}
          </p>
        </div>
        {selecting ? null : (
          <div className="flex flex-wrap gap-2">
            {screens.length > 1 ? (
              <Button size="lg" variant="outline" onClick={() => setSelecting(true)}>
                <CheckSquareIcon /> Select TVs
              </Button>
            ) : null}
            <Button size="lg" onClick={() => setAddOpen(true)}>
              <PlusIcon /> Add a TV
            </Button>
          </div>
        )}
      </div>

      {selecting ? (
        <div
          className="sticky top-[4.5rem] z-30 flex flex-wrap items-center gap-2 rounded-2xl bg-foreground p-3 text-background shadow-lg"
          data-testid="selection-toolbar"
        >
          <span className="px-1 text-sm font-semibold">
            {selectedIds.length} selected
          </span>
          <Button size="sm" disabled={selectedIds.length === 0 || busy} onClick={() => syncMany.mutate({ ids: selectedIds, sync: true })}>
            <RadioIcon /> Play together
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedIds.length === 0 || busy}
            onClick={() => syncMany.mutate({ ids: selectedIds, sync: false })}
          >
            Stop playing together
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedPairedIds.length === 0 || busy}
            onClick={() => actMany.mutate({ ids: selectedPairedIds, action: 'identify' })}
          >
            <MegaphoneIcon /> Flash names
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedPairedIds.length === 0 || busy}
            onClick={() => actMany.mutate({ ids: selectedPairedIds, action: 'reload' })}
          >
            <RefreshCwIcon /> Restart
          </Button>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={exitSelection} disabled={busy}>
            Done
          </Button>
        </div>
      ) : null}

      {screensQuery.isPending ? (
        <div className={GRID}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-2xl" />
          ))}
        </div>
      ) : screensQuery.isError ? (
        <p className="text-sm text-destructive">Could not load your TVs.</p>
      ) : screens.length === 0 ? (
        <EmptyState
          icon={<PlusIcon />}
          title="Add your first TV"
          description="You get a short code. Type it on the TV in the MSIGN app and it joins this page."
          action={
            <Button size="xl" onClick={() => setAddOpen(true)}>
              <PlusIcon /> Add a TV
            </Button>
          }
        />
      ) : (
        <div className={GRID}>
          {screens.map((s) => (
            <TvCard
              key={s.id}
              screen={s}
              onOpen={() => router.push(`/tvs/${s.id}`)}
              onShowCode={() => setCodeTarget(s)}
              onHelpOffline={() => setHelpTarget(s)}
              selectable={selecting}
              selected={selected.has(s.id)}
              onToggleSelect={() => toggleSelect(s.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CircleHelpIcon className="size-6" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-bold">Not sure what to do?</span>
          <span className="text-[15px] text-muted-foreground">
            Tap a TV to change what it shows. To add new pictures, go to <Link href="/photos" className="font-semibold text-primary">Photos</Link>. Anything else,
            call MTech.
          </span>
        </div>
        <Button
          variant="outline"
          size="lg"
          render={<a href={tel ?? `mailto:${SUPPORT_EMAIL}`} />}
        >
          {tel ? `Call MTech ${SUPPORT_PHONE}` : 'Email MTech'}
        </Button>
      </div>

      <AddTvDialog open={addOpen} onOpenChange={setAddOpen} onCreated={(s) => setCodeTarget(s)} />
      <ScreenCodeDialog
        screen={codeTarget}
        onOpenChange={(open) => {
          if (!open) setCodeTarget(null)
        }}
      />
      <OfflineHelpDialog
        screen={helpTarget}
        onOpenChange={(open) => {
          if (!open) setHelpTarget(null)
        }}
      />
    </div>
  )
}

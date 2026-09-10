'use client'

/**
 * components/admin/FleetPage.tsx — /admin/tvs (docs/CONTRACTS.md §23): every TV of every
 * location. Click tiles to select; a black action bar offers Sync from 0:00 / Unsync / Flash
 * names / Restart across locations (POST /api/admin/screens/actions). Filters by location
 * and status. Polls every 15 s (the fleet is not org-scoped, so realtime does not cover it).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ExternalLinkIcon, MaximizeIcon, MegaphoneIcon, RadioIcon, RefreshCwIcon, SearchIcon, SettingsIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { TvFrame } from '@/components/screens/TvFrame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { isOnline, screenStatus } from '@/lib/status'
import { cn, relativeTime } from '@/lib/utils'
import type { FleetAction, FleetScreenView } from '@/types/api'

type StatusChip = 'all' | 'online' | 'offline' | 'unpaired'
const ALL_ORGS = '__all__'

export function FleetPage() {
  const router = useRouter()
  const { setActiveOrg } = useApp()
  const queryClient = useQueryClient()
  const now = useNow(5000)
  const [orgFilter, setOrgFilter] = useState<string>(ALL_ORGS)
  const [statusChip, setStatusChip] = useState<StatusChip>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fleetQuery = useQuery({
    queryKey: queryKeys.fleet.list(),
    queryFn: () => apiFetch<FleetScreenView[]>('/api/admin/screens'),
    refetchInterval: 15_000,
  })

  const act = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: FleetAction }) =>
      apiFetch<{ updated: number }>('/api/admin/screens/actions', { method: 'POST', json: { ids, action } }),
    onSuccess: ({ updated }, { action }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.fleet.all() })
      const n = `${updated} ${updated === 1 ? 'TV' : 'TVs'}`
      toast.success(
        action === 'sync'
          ? `${n} now play in sync from the start`
          : action === 'unsync'
            ? `Sync turned off for ${n}`
            : action === 'identify'
              ? `${n} show their name for a few seconds`
              : `Restarting ${n}`,
      )
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const screens = useMemo(
    () => (fleetQuery.data ?? []).map((s) => ({ ...s, online: isOnline(s.last_seen_at, now) })),
    [fleetQuery.data, now],
  )
  const orgItems = useMemo(() => {
    const map: Record<string, string> = { [ALL_ORGS]: 'All locations' }
    for (const s of screens) map[s.org_id] = s.org_name
    return map
  }, [screens])
  const visible = screens.filter((s) => {
    if (orgFilter !== ALL_ORGS && s.org_id !== orgFilter) return false
    if (statusChip !== 'all' && screenStatus(s) !== statusChip) return false
    const q = search.trim().toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.org_name.toLowerCase().includes(q)
  })
  const counts = {
    total: screens.length,
    online: screens.filter((s) => s.online).length,
    offline: screens.filter((s) => screenStatus(s) === 'offline').length,
    locations: new Set(screens.map((s) => s.org_id)).size,
  }
  const selectedIds = visible.filter((s) => selected.has(s.id)).map((s) => s.id)
  const selectedPaired = visible.filter((s) => selected.has(s.id) && s.paired).map((s) => s.id)

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const goTo = async (orgId: string, to: string) => {
    try {
      await setActiveOrg(orgId)
      router.push(to)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open that location')
    }
  }

  const chips: { key: StatusChip; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'On' },
    { key: 'offline', label: 'Off' },
    { key: 'unpaired', label: 'Not signed in' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">All TVs</h1>
          <p className="text-base text-muted-foreground">
            {fleetQuery.isPending
              ? 'Loading…'
              : `${counts.total} TVs across ${counts.locations} ${counts.locations === 1 ? 'location' : 'locations'} · ${counts.online} on · `}
            {fleetQuery.isPending ? null : <span className={counts.offline > 0 ? 'font-bold text-offline' : ''}>{counts.offline} off</span>}
          </p>
        </div>
        <Select items={orgItems} value={orgFilter} onValueChange={(v) => setOrgFilter(v ?? ALL_ORGS)}>
          <SelectTrigger className="h-10 min-w-48" aria-label="Location">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(orgItems).map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a TV…" className="h-10 rounded-xl pl-9" aria-label="Search TVs" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setStatusChip(c.key)}
            className={cn(
              'h-9 rounded-xl border px-3.5 text-sm font-semibold transition-colors',
              statusChip === c.key ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:bg-muted',
            )}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">Click a TV to select it.</span>
      </div>

      {selectedIds.length > 0 ? (
        <div className="sticky top-[4.5rem] z-30 flex flex-wrap items-center gap-2 rounded-2xl bg-foreground p-3 text-background shadow-lg" data-testid="fleet-toolbar">
          <span className="px-1 text-sm font-bold">
            {selectedIds.length} {selectedIds.length === 1 ? 'TV' : 'TVs'} selected
          </span>
          <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ ids: selectedIds, action: 'sync' })}>
            <RadioIcon /> Sync from 0:00
          </Button>
          <Button size="sm" variant="secondary" disabled={act.isPending} onClick={() => act.mutate({ ids: selectedIds, action: 'unsync' })}>
            Unsync
          </Button>
          <Button size="sm" variant="secondary" disabled={act.isPending || selectedPaired.length === 0} onClick={() => act.mutate({ ids: selectedPaired, action: 'identify' })}>
            <MegaphoneIcon /> Flash names
          </Button>
          <Button size="sm" variant="secondary" disabled={act.isPending || selectedPaired.length === 0} onClick={() => act.mutate({ ids: selectedPaired, action: 'reload' })}>
            <RefreshCwIcon /> Restart
          </Button>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {fleetQuery.isPending ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : fleetQuery.isError ? (
        <p className="text-sm text-destructive">Could not load the fleet.</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No TVs match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {visible.map((s) => {
            const status = screenStatus(s)
            const on = selected.has(s.id)
            return (
              <div
                key={s.id}
                className={cn(
                  'relative flex flex-col gap-2 rounded-2xl border bg-card p-2.5',
                  on ? 'border-primary ring-2 ring-primary/30' : status === 'offline' ? 'border-offline/40' : 'border-border',
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`Select ${s.name}`}
                  onClick={() => toggle(s.id)}
                  className="relative block w-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <TvFrame
                    thumbUrl={s.current_item?.thumb_url ?? s.preview_thumb_url}
                    status={status}
                    rotation={s.rotation}
                    orientation={s.orientation}
                    websiteUrl={s.current_item?.website_url ?? s.preview_website_url}
                  >
                    <span
                      className={cn(
                        'absolute top-1.5 left-1.5 z-10 flex size-6 items-center justify-center rounded-md border-2 border-white shadow',
                        on ? 'bg-primary text-white' : 'bg-black/40',
                      )}
                    >
                      {on ? <CheckIcon className="size-4" /> : null}
                    </span>
                    <span className="absolute bottom-1.5 left-1.5 z-10 flex gap-1">
                      {s.sync ? <span className="rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-white">Synced</span> : null}
                      {s.orientation === 'portrait' ? <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">Portrait</span> : null}
                    </span>
                  </TvFrame>
                </button>
                <div className="flex items-start gap-1 px-0.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.org_name}</div>
                    <div className={cn('truncate text-xs', status === 'offline' ? 'font-semibold text-offline' : 'text-muted-foreground')}>
                      {status === 'offline'
                        ? `Off · last seen ${relativeTime(s.last_seen_at, now)}`
                        : status === 'unpaired'
                          ? 'Not signed in'
                          : (s.menu_name ?? s.current_item?.name ?? 'Nothing assigned')}
                    </div>
                  </div>
                  <KebabMenu
                    label={`Actions for ${s.name}`}
                    items={[
                      { label: 'Open TV page', icon: <SettingsIcon />, onSelect: () => void goTo(s.org_id, `/tvs/${s.id}`) },
                      { label: 'Open location', icon: <ExternalLinkIcon />, onSelect: () => void goTo(s.org_id, '/tvs') },
                      {
                        label: 'Watch full screen',
                        icon: <MaximizeIcon />,
                        disabled: !s.login_code,
                        onSelect: () => window.open(`/player?code=${s.login_code ?? ''}`, '_blank', 'noopener'),
                      },
                      {
                        label: s.sync ? 'Turn sync off' : 'Sync from 0:00',
                        icon: <RadioIcon />,
                        separatorBefore: true,
                        onSelect: () => act.mutate({ ids: [s.id], action: s.sync ? 'unsync' : 'sync' }),
                      },
                    ]}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

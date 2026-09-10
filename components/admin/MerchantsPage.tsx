'use client'

/**
 * components/admin/MerchantsPage.tsx — /admin/merchants (docs/CONTRACTS.md §23): every store
 * with how its TVs are doing right now. Stat tiles, filter chips, a health table sorted
 * needs-attention-first, plan select inline, Manage → /admin/merchants/[id].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MerchantDialog } from '@/components/admin/MerchantDialog'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn, initials, relativeTime } from '@/lib/utils'
import { SUBSCRIPTION_LABELS, SUBSCRIPTION_TIERS, type MerchantView, type OkResponse, type SubscriptionTier } from '@/types/api'

type Chip = 'all' | 'off' | 'new'
const NEW_WINDOW_MS = 30 * 24 * 3600 * 1000

function tvs(m: MerchantView): number {
  return m.locations.reduce((n, l) => n + l.screen_count, 0)
}
function paired(m: MerchantView): number {
  return m.locations.reduce((n, l) => n + l.paired_count, 0)
}
function on(m: MerchantView): number {
  return m.locations.reduce((n, l) => n + l.online_count, 0)
}
/** TVs that have signed in before but are not talking now — the ones worth a phone call. */
function off(m: MerchantView): number {
  return Math.max(0, paired(m) - on(m))
}

export function MerchantsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState<Chip>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MerchantView | null>(null)

  const merchantsQuery = useQuery({
    queryKey: queryKeys.merchants.list(),
    queryFn: () => apiFetch<MerchantView[]>('/api/merchants'),
    refetchInterval: 30_000,
  })

  const removeMutation = useMutation({
    mutationFn: (target: MerchantView) => apiFetch<OkResponse>(`/api/merchants/${target.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success('Merchant removed')
      setRemoveTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const subscriptionMutation = useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: SubscriptionTier }) =>
      apiFetch<OkResponse>(`/api/merchants/${id}/subscription`, { method: 'POST', json: { tier } }),
    onMutate: async ({ id, tier }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.merchants.list() })
      const prev = queryClient.getQueryData<MerchantView[]>(queryKeys.merchants.list())
      queryClient.setQueryData<MerchantView[]>(queryKeys.merchants.list(), (old) =>
        (old ?? []).map((m) => (m.id === id ? { ...m, subscription_tier: tier } : m)),
      )
      return { prev }
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.merchants.list(), ctx.prev)
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    },
    onSuccess: () => toast.success('Plan updated'),
  })

  const all = useMemo(() => merchantsQuery.data ?? [], [merchantsQuery.data])
  const totals = useMemo(
    () => ({
      merchants: all.length,
      tvs: all.reduce((n, m) => n + tvs(m), 0),
      on: all.reduce((n, m) => n + on(m), 0),
      off: all.reduce((n, m) => n + off(m), 0),
    }),
    [all],
  )
  const attention = totals.off

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = Date.now()
    return all
      .filter((m) => {
        if (chip === 'off' && off(m) === 0) return false
        if (chip === 'new' && now - new Date(m.created_at).getTime() > NEW_WINDOW_MS) return false
        if (!q) return true
        return (
          m.email.toLowerCase().includes(q) ||
          m.locations.some((l) => l.name.toLowerCase().includes(q)) ||
          m.employees.some((e) => e.email.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => off(b) - off(a) || a.email.localeCompare(b.email))
  }, [all, chip, search])

  const chips: { key: Chip; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'off', label: 'Has a TV off' },
    { key: 'new', label: 'New this month' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Merchants</h1>
          <p className="text-base text-muted-foreground">Every store you manage, with how its TVs are doing right now.</p>
        </div>
        <Button size="lg" onClick={() => setAddOpen(true)}>
          <PlusIcon /> Add merchant
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="eyebrow">Merchants</span>
          <span className="text-3xl font-extrabold">{totals.merchants}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="eyebrow">TVs</span>
          <span className="text-3xl font-extrabold">{totals.tvs}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="eyebrow">On right now</span>
          <span className="text-3xl font-extrabold text-online">{totals.on}</span>
        </div>
        <div className={cn('flex flex-col gap-1 rounded-2xl border p-4', attention > 0 ? 'border-offline/30 bg-offline-soft' : 'border-border bg-card')}>
          <span className={cn('eyebrow', attention > 0 && 'text-offline')}>Need attention</span>
          <span className="flex items-baseline gap-3">
            <span className={cn('text-3xl font-extrabold', attention > 0 ? 'text-offline' : 'text-foreground')}>{attention}</span>
            {attention > 0 ? (
              <button type="button" onClick={() => setChip('off')} className="text-sm font-bold text-offline hover:underline">
                See which
              </button>
            ) : null}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChip(c.key)}
            className={cn(
              'h-10 rounded-xl border px-4 text-sm font-semibold transition-colors',
              chip === c.key ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:bg-muted',
            )}
          >
            {c.label}
          </button>
        ))}
        <div className="relative ml-auto w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a merchant, employee or location…"
            className="h-10 rounded-xl pl-9"
            aria-label="Search merchants"
          />
        </div>
      </div>

      {merchantsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : merchantsQuery.isError ? (
        <p className="text-sm text-destructive">
          {merchantsQuery.error instanceof Error ? merchantsQuery.error.message : 'Could not load merchants.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[2.2fr_1fr_1fr_1.6fr_1.1fr_1fr_120px] items-center gap-3 bg-muted/60 px-4 py-2.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              <span>Merchant</span>
              <span>Locations</span>
              <span>TVs</span>
              <span>TV health</span>
              <span>Plan</span>
              <span>Last sign-in</span>
              <span />
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-muted-foreground">
                {all.length === 0 ? 'No merchants yet. Add one and hand the login to the store.' : 'No merchants match.'}
              </p>
            ) : (
              rows.map((m) => {
                const total = tvs(m)
                const online = on(m)
                const down = off(m)
                const never = total - paired(m)
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[2.2fr_1fr_1fr_1.6fr_1.1fr_1fr_120px] items-center gap-3 border-t border-border px-4 py-3 text-[15px]"
                  >
                    <Link href={`/admin/merchants/${m.id}`} className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold',
                          down > 0 ? 'bg-offline-soft text-offline' : 'bg-primary/10 text-primary',
                        )}
                      >
                        {initials(m.locations[0]?.name ?? m.email)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{m.locations[0]?.name ?? m.email}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                      </span>
                    </Link>
                    <span>{m.locations.length}</span>
                    <span>{total}</span>
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-2 w-28 overflow-hidden rounded-full bg-border">
                        {total > 0 ? (
                          <>
                            <span className="bg-online" style={{ width: `${(online / total) * 100}%` }} />
                            <span className="bg-offline" style={{ width: `${(down / total) * 100}%` }} />
                          </>
                        ) : null}
                      </span>
                      <span className={cn('text-xs font-bold', down > 0 ? 'text-offline' : online > 0 ? 'text-online' : 'text-muted-foreground')}>
                        {total === 0
                          ? 'no TVs'
                          : down > 0
                            ? `${down} off`
                            : never === total
                              ? 'none signed in yet'
                              : never > 0
                                ? `${online} on · ${never} not signed in`
                                : 'all on'}
                      </span>
                    </span>
                    <span>
                      <Select
                        items={SUBSCRIPTION_LABELS}
                        value={m.subscription_tier}
                        onValueChange={(v) => {
                          if (v && v !== m.subscription_tier) subscriptionMutation.mutate({ id: m.id, tier: v as SubscriptionTier })
                        }}
                      >
                        <SelectTrigger className="h-9 w-[7.5rem]" aria-label={`Plan for ${m.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBSCRIPTION_TIERS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {SUBSCRIPTION_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </span>
                    <span className="text-muted-foreground">{relativeTime(m.last_sign_in_at)}</span>
                    <span className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" render={<Link href={`/admin/merchants/${m.id}`} />}>
                        Manage
                      </Button>
                      <KebabMenu
                        label={`Actions for ${m.email}`}
                        items={[{ label: 'Remove merchant', destructive: true, onSelect: () => setRemoveTarget(m) }]}
                      />
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <MerchantDialog open={addOpen} onOpenChange={setAddOpen} />
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title={removeTarget ? `Remove ${removeTarget.email}?` : 'Remove merchant'}
        description="This deletes their login and every one of their locations — TVs, photos and menus included. This cannot be undone."
        confirmLabel="Remove"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget && !removeMutation.isPending) removeMutation.mutate(removeTarget)
        }}
      />
    </div>
  )
}

'use client'

/**
 * components/admin/MerchantsSection.tsx — the Team page's main list: the merchants (stores) that
 * use MSIGN. Search, add (creates login + first location), click a row to manage its locations /
 * reset password, or remove. Removing deletes the login and all of that merchant's locations.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SearchIcon, TvIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MerchantDialog } from '@/components/admin/MerchantDialog'
import { MerchantManageDialog } from '@/components/admin/MerchantManageDialog'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { relativeTime } from '@/lib/utils'
import { SUBSCRIPTION_LABELS, SUBSCRIPTION_TIERS } from '@/types/api'
import type { MerchantView, OkResponse, SubscriptionTier } from '@/types/api'

function locationsLabel(m: MerchantView): string {
  if (m.locations.length === 0) return '—'
  if (m.locations.length <= 2) return m.locations.map((l) => l.name).join(', ')
  return `${m.locations[0]?.name} +${m.locations.length - 1} more`
}

export function MerchantsSection() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [manageTarget, setManageTarget] = useState<MerchantView | null>(null)
  const [removeTarget, setRemoveTarget] = useState<MerchantView | null>(null)

  const merchantsQuery = useQuery({
    queryKey: queryKeys.merchants.list(),
    queryFn: () => apiFetch<MerchantView[]>('/api/merchants'),
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
    onSuccess: () => toast.success('Subscription updated'),
  })

  const filtered = useMemo(() => {
    const all = merchantsQuery.data ?? []
    const q = search.trim().toLowerCase()
    if (q.length === 0) return all
    return all.filter(
      (m) => m.email.toLowerCase().includes(q) || m.locations.some((l) => l.name.toLowerCase().includes(q)),
    )
  }, [merchantsQuery.data, search])

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Merchants</h2>
          <p className="text-sm text-muted-foreground">
            The stores that use MSIGN. Click one to manage its locations or reset its password.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <TvIcon /> Add merchant
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or location…"
          className="pl-9"
          aria-label="Search merchants"
        />
      </div>

      {merchantsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : merchantsQuery.isError ? (
        <p className="text-sm text-destructive">
          {merchantsQuery.error instanceof Error ? merchantsQuery.error.message : 'Could not load merchants.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Email</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="w-12 pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {merchantsQuery.data.length === 0
                      ? 'No merchants yet. Add one and hand the credentials to the store.'
                      : 'No merchants match your search.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => setManageTarget(m)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setManageTarget(m)
                      }
                    }}
                  >
                    <TableCell className="pl-4 font-medium">{m.email}</TableCell>
                    <TableCell className="text-muted-foreground">{locationsLabel(m)}</TableCell>
                    <TableCell className="text-muted-foreground">{m.role === 'admin' ? 'Manager' : 'TV only'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={m.subscription_tier}
                        onValueChange={(v) => {
                          if (v && v !== m.subscription_tier) {
                            subscriptionMutation.mutate({ id: m.id, tier: v as SubscriptionTier })
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[7.5rem]" aria-label={`Subscription for ${m.email}`}>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">{relativeTime(m.last_sign_in_at)}</TableCell>
                    <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <KebabMenu
                        label={`Actions for ${m.email}`}
                        items={[
                          { label: 'Manage', onSelect: () => setManageTarget(m) },
                          { label: 'Remove', destructive: true, onSelect: () => setRemoveTarget(m) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <MerchantDialog open={addOpen} onOpenChange={setAddOpen} />
      <MerchantManageDialog
        merchant={manageTarget}
        open={manageTarget !== null}
        onOpenChange={(open) => {
          if (!open) setManageTarget(null)
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title={removeTarget ? `Remove ${removeTarget.email}?` : 'Remove merchant'}
        description="This deletes their login and every one of their locations — screens, content and menus included. This cannot be undone."
        confirmLabel="Remove"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget && !removeMutation.isPending) removeMutation.mutate(removeTarget)
        }}
      />
    </section>
  )
}

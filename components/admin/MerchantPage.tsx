'use client'

/**
 * components/admin/MerchantPage.tsx — /admin/merchants/[id] (docs/CONTRACTS.md §23): the old
 * manage dialog as a full page. Locations side by side (rename, counts, who can reach it, open),
 * add a location (optionally copying one), employees, plan, owner password, "Open as this merchant".
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, ExternalLinkIcon, KeyRoundIcon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { LocationPanel } from '@/components/admin/LocationPanel'
import { MerchantEmployees } from '@/components/admin/MerchantEmployees'
import { generatePassword } from '@/components/admin/password'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { initials, relativeTime } from '@/lib/utils'
import { SUBSCRIPTION_LABELS, SUBSCRIPTION_TIERS, type MerchantView, type OkResponse, type SubscriptionTier } from '@/types/api'

const NO_COPY = '__none__'

export function MerchantPage({ id }: { id: string }) {
  const router = useRouter()
  const { setActiveOrg } = useApp()
  const queryClient = useQueryClient()
  const [locationName, setLocationName] = useState('')
  const [copyFrom, setCopyFrom] = useState<string>(NO_COPY)
  const [newPassword, setNewPassword] = useState('')
  const [removeOpen, setRemoveOpen] = useState(false)

  const merchantQuery = useQuery({
    queryKey: queryKeys.merchants.detail(id),
    queryFn: () => apiFetch<MerchantView>(`/api/merchants/${id}`),
  })
  const setView = (m: MerchantView) => {
    queryClient.setQueryData(queryKeys.merchants.detail(id), m)
    void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.list() })
  }
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong')

  const addLocation = useMutation({
    mutationFn: (input: { location_name: string; copy_from_org_id?: string }) =>
      apiFetch<MerchantView>(`/api/merchants/${id}/locations`, { method: 'POST', json: input }),
    onSuccess: (updated) => {
      setView(updated)
      setLocationName('')
      setCopyFrom(NO_COPY)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success('Location added')
    },
    onError: fail,
  })
  const resetPassword = useMutation({
    mutationFn: (password: string) =>
      apiFetch<OkResponse>(`/api/merchants/${id}/password`, { method: 'POST', json: { password } }),
    onSuccess: () => {
      toast.success('Password updated — hand the new one to the store')
      setNewPassword('')
    },
    onError: fail,
  })
  const subscription = useMutation({
    mutationFn: (tier: SubscriptionTier) =>
      apiFetch<OkResponse>(`/api/merchants/${id}/subscription`, { method: 'POST', json: { tier } }),
    onSuccess: (_ok, tier) => {
      const current = queryClient.getQueryData<MerchantView>(queryKeys.merchants.detail(id))
      if (current) setView({ ...current, subscription_tier: tier })
      toast.success('Plan updated')
    },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: () => apiFetch<OkResponse>(`/api/merchants/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success('Merchant removed')
      router.push('/admin/merchants')
    },
    onError: fail,
  })

  const openLocation = async (orgId: string, to = '/tvs') => {
    try {
      await setActiveOrg(orgId)
      router.push(to)
    } catch (e) {
      fail(e)
    }
  }

  if (merchantQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  const view = merchantQuery.data
  if (merchantQuery.isError || !view) {
    return (
      <EmptyState
        title="Merchant not found"
        action={
          <Button variant="outline" render={<Link href="/admin/merchants" />}>
            Back to merchants
          </Button>
        }
      />
    )
  }

  const locations = view.locations
  const employees = view.employees
  const totalTvs = locations.reduce((n, l) => n + l.screen_count, 0)
  const copyItems: Record<string, string> = {
    [NO_COPY]: 'Start empty',
    ...Object.fromEntries(locations.map((l) => [l.id, l.name] as const)),
  }
  const first = locations[0]

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/merchants" className="inline-flex w-fit items-center gap-1 text-[15px] font-semibold text-primary hover:underline">
        <ArrowLeftIcon className="size-4" /> Merchants
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
          {initials(first?.name ?? view.email)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-3xl font-extrabold tracking-tight">{first?.name ?? view.email}</h1>
          <p className="text-[15px] text-muted-foreground">
            {view.email} · {view.role === 'admin' ? 'Manager login' : 'TV-only login'} · joined{' '}
            {new Date(view.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} · {locations.length}{' '}
            {locations.length === 1 ? 'location' : 'locations'} · {totalTvs} {totalTvs === 1 ? 'TV' : 'TVs'} · last sign-in{' '}
            {relativeTime(view.last_sign_in_at)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select items={SUBSCRIPTION_LABELS} value={view.subscription_tier} onValueChange={(v) => v && subscription.mutate(v as SubscriptionTier)}>
            <SelectTrigger className="h-10" aria-label="Plan">
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
          {first ? (
            <Button size="lg" onClick={() => void openLocation(first.id)}>
              <ExternalLinkIcon /> Open as this merchant
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Locations</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {locations.map((l) => (
                <LocationPanel
                  key={l.id}
                  location={l}
                  staff={employees.filter((e) => e.location_ids.includes(l.id))}
                  onOpen={() => void openLocation(l.id)}
                  onRenamed={(name) => setView({ ...view, locations: view.locations.map((x) => (x.id === l.id ? { ...x, name } : x)) })}
                />
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (locationName.trim().length === 0 || addLocation.isPending) return
                  addLocation.mutate({
                    location_name: locationName.trim(),
                    copy_from_org_id: copyFrom === NO_COPY ? undefined : copyFrom,
                  })
                }}
                className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-border p-4"
              >
                <Label className="text-base font-bold">Add a location</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Airport store"
                  autoComplete="off"
                  disabled={addLocation.isPending}
                />
                {locations.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Copy photos &amp; menus from</Label>
                    <Select items={copyItems} value={copyFrom} onValueChange={(v) => setCopyFrom(v ?? NO_COPY)}>
                      <SelectTrigger aria-label="Copy content from location">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_COPY}>Start empty</SelectItem>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <Button type="submit" size="sm" className="self-start" disabled={locationName.trim().length === 0 || addLocation.isPending}>
                  <PlusIcon /> {addLocation.isPending ? 'Adding…' : 'Add location'}
                </Button>
              </form>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <MerchantEmployees merchant={view} onUpdated={setView} />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <KeyRoundIcon className="size-5 text-primary" /> Owner password
            </h2>
            <p className="text-sm text-muted-foreground">Set a new password for {view.email} and hand it to the store.</p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="off"
                minLength={8}
                disabled={resetPassword.isPending}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" aria-label="Generate password" onClick={() => setNewPassword(generatePassword())}>
                <RefreshCwIcon />
              </Button>
            </div>
            <Button variant="outline" onClick={() => resetPassword.mutate(newPassword)} disabled={newPassword.length < 8 || resetPassword.isPending}>
              {resetPassword.isPending ? 'Saving…' : 'Save new password'}
            </Button>
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-bold">Plan</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current</span>
              <b>{SUBSCRIPTION_LABELS[view.subscription_tier]}</b>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVs</span>
              <b>{totalTvs}</b>
            </div>
            <p className="text-xs text-muted-foreground">Billing is tracked outside MSIGN for now; change the plan at the top of the page.</p>
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-offline/30 p-4">
            <h2 className="text-base font-bold text-offline">Remove this merchant</h2>
            <p className="text-sm text-muted-foreground">Deletes the login, the employees and every location with its TVs, photos and menus.</p>
            <Button variant="destructive" className="self-start" onClick={() => setRemoveOpen(true)}>
              Remove merchant
            </Button>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove ${view.email}?`}
        description="This deletes their login and every one of their locations — TVs, photos and menus included. This cannot be undone."
        confirmLabel="Remove"
        destructive
        confirmText={view.email}
        loading={remove.isPending}
        onConfirm={() => {
          if (!remove.isPending) remove.mutate()
        }}
      />
    </div>
  )
}

'use client'

/**
 * components/admin/MerchantEmployees.tsx — a merchant's employees (CONTRACTS addendum §19): extra
 * logins that reach some or all of the merchant's locations as Manager or TV only. Add one (email,
 * password, access, locations), change access inline, toggle locations, reset a password, remove.
 * Every write returns the refreshed MerchantView, handed up through `onUpdated`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCwIcon, UserPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { generatePassword } from '@/components/admin/password'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn, relativeTime } from '@/lib/utils'
import type { EmployeeView, MerchantView, OkResponse } from '@/types/api'

type Role = 'member' | 'admin'
const toRole = (v: unknown): Role => (String(v) === 'admin' ? 'admin' : 'member')
// Base UI's Select.Value shows the raw value unless the root knows the labels.
const ROLE_SHORT: Record<Role, string> = { member: 'TV only', admin: 'Manager' }
const ROLE_LONG: Record<Role, string> = { member: 'TV display only', admin: 'Manager — can use the console' }

function LocationToggles({
  merchant,
  selected,
  onChange,
}: {
  merchant: MerchantView
  selected: string[]
  onChange(next: string[]): void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {merchant.locations.map((l) => {
        const on = selected.includes(l.id)
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== l.id) : [...selected, l.id])}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {l.name}
          </button>
        )
      })}
    </div>
  )
}

export function MerchantEmployees({ merchant, onUpdated }: { merchant: MerchantView; onUpdated(m: MerchantView): void }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [orgIds, setOrgIds] = useState<string[]>([])
  const [removeTarget, setRemoveTarget] = useState<EmployeeView | null>(null)
  const [pwTarget, setPwTarget] = useState<EmployeeView | null>(null)
  const [pw, setPw] = useState('')

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong')
  const base = `/api/merchants/${merchant.id}/employees`

  const create = useMutation({
    mutationFn: (input: { email: string; password: string; role: Role; org_ids: string[] }) =>
      apiFetch<MerchantView>(base, { method: 'POST', json: input }),
    onSuccess: (m, input) => {
      onUpdated(m)
      invalidate()
      toast.success(`Employee login created for ${input.email}`)
      setAdding(false)
    },
    onError: fail,
  })
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; role?: Role; org_ids?: string[] }) =>
      apiFetch<MerchantView>(`${base}/${id}`, { method: 'PATCH', json: input }),
    onSuccess: (m) => {
      onUpdated(m)
      invalidate()
      toast.success('Access updated')
    },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<OkResponse>(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: (_ok, id) => {
      onUpdated({ ...merchant, employees: merchant.employees.filter((e) => e.id !== id) })
      invalidate()
      toast.success('Employee removed')
      setRemoveTarget(null)
    },
    onError: fail,
  })
  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiFetch<OkResponse>(`/api/merchants/${id}/password`, { method: 'POST', json: { password } }),
    onSuccess: () => {
      toast.success('Password updated — hand the new one to the employee')
      setPwTarget(null)
      setPw('')
    },
    onError: fail,
  })

  const startAdd = () => {
    setEmail('')
    setPassword(generatePassword())
    setRole('member')
    setOrgIds(merchant.locations.map((l) => l.id))
    setAdding(true)
  }
  const canCreate = email.trim().length > 0 && password.length >= 8 && orgIds.length > 0 && !create.isPending
  const multi = merchant.locations.length > 1

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Employees</Label>
        {!adding ? (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            <UserPlusIcon /> Add employee
          </Button>
        ) : null}
      </div>
      <div className="rounded-md border border-border">
        {merchant.employees.length === 0 && !adding ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No employees yet. Add one to give a staff member their own login — as a Manager or for a TV only.
          </p>
        ) : null}
        {merchant.employees.map((e) => (
          <div key={e.id} className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.email}</div>
                <div className="text-xs text-muted-foreground">
                  {e.last_sign_in_at ? `Last sign-in ${relativeTime(e.last_sign_in_at)}` : 'Never signed in'}
                </div>
              </div>
              <Select
                items={ROLE_SHORT}
                value={e.role === 'admin' ? 'admin' : 'member'}
                onValueChange={(v) => {
                  const next = toRole(v)
                  if (next !== (e.role === 'admin' ? 'admin' : 'member')) update.mutate({ id: e.id, role: next })
                }}
                disabled={update.isPending}
              >
                <SelectTrigger size="sm" className="w-[8.5rem]" aria-label={`Access for ${e.email}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{ROLE_SHORT.member}</SelectItem>
                  <SelectItem value="admin">{ROLE_SHORT.admin}</SelectItem>
                </SelectContent>
              </Select>
              <KebabMenu
                label={`Actions for ${e.email}`}
                items={[
                  {
                    label: 'Reset password',
                    onSelect: () => {
                      setPwTarget(e)
                      setPw(generatePassword())
                    },
                  },
                  { label: 'Remove', destructive: true, separatorBefore: true, onSelect: () => setRemoveTarget(e) },
                ]}
              />
            </div>
            {multi ? (
              <LocationToggles
                merchant={merchant}
                selected={e.location_ids}
                onChange={(next) => {
                  if (next.length === 0) {
                    toast.error('An employee needs at least one location')
                    return
                  }
                  update.mutate({ id: e.id, org_ids: next })
                }}
              />
            ) : null}
            {pwTarget?.id === e.id ? (
              <div className="flex gap-2">
                <Input
                  value={pw}
                  onChange={(ev) => setPw(ev.target.value)}
                  autoComplete="off"
                  minLength={8}
                  className="font-mono"
                  aria-label={`New password for ${e.email}`}
                  disabled={resetPassword.isPending}
                />
                <Button type="button" variant="outline" size="icon" aria-label="Generate password" onClick={() => setPw(generatePassword())}>
                  <RefreshCwIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pw.length < 8 || resetPassword.isPending}
                  onClick={() => resetPassword.mutate({ id: e.id, password: pw })}
                >
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPwTarget(null)}>
                  Cancel
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {adding ? (
          <form
            onSubmit={(ev) => {
              ev.preventDefault()
              if (canCreate) create.mutate({ email: email.trim(), password, role, org_ids: orgIds })
            }}
            className="flex flex-col gap-3 border-t border-border bg-muted/40 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="employee-email">Email</Label>
                <Input id="employee-email" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="staff@merchant.com" autoComplete="off" autoFocus required disabled={create.isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="employee-password">Password</Label>
                <div className="flex gap-2">
                  <Input id="employee-password" value={password} onChange={(ev) => setPassword(ev.target.value)} autoComplete="off" minLength={8} required className="font-mono" disabled={create.isPending} />
                  <Button type="button" variant="outline" size="icon" aria-label="Generate password" onClick={() => setPassword(generatePassword())}>
                    <RefreshCwIcon />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Access</Label>
              <Select items={ROLE_LONG} value={role} onValueChange={(v) => setRole(toRole(v))}>
                <SelectTrigger aria-label="Access level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{ROLE_LONG.member}</SelectItem>
                  <SelectItem value="admin">{ROLE_LONG.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {multi ? (
              <div className="flex flex-col gap-1.5">
                <Label>Locations</Label>
                <LocationToggles merchant={merchant} selected={orgIds} onChange={setOrgIds} />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canCreate}>
                {create.isPending ? 'Creating…' : 'Create login'}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title={removeTarget ? `Remove ${removeTarget.email}?` : 'Remove employee'}
        description="This deletes their login. The merchant's locations, TVs and content are untouched."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (removeTarget && !remove.isPending) remove.mutate(removeTarget.id)
        }}
      />
    </section>
  )
}

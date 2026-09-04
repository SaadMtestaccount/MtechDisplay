'use client'

/**
 * components/admin/MerchantDialog.tsx — create a store login (addendum §13): MTech types the
 * email + password, picks the location(s) it can access, and the access level. A Manager can be
 * assigned to several locations and switches between them.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, RefreshCwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import type { MerchantView } from '@/types/api'
import type { Organization } from '@/types/db'

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generatePassword(): string {
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('')
}

export function MerchantDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgIds, setOrgIds] = useState<string[]>([])
  const [role, setRole] = useState<'member' | 'admin'>('member')

  useEffect(() => {
    if (open) {
      setEmail('')
      setPassword(generatePassword())
      setOrgIds([])
      setRole('member')
    }
  }, [open])

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: () => apiFetch<Organization[]>('/api/orgs'),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (input: { email: string; password: string; org_ids: string[]; role: 'member' | 'admin' }) =>
      apiFetch<MerchantView>('/api/merchants', { method: 'POST', json: input }),
    onSuccess: (merchant) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      toast.success(`${merchant.role === 'admin' ? 'Manager' : 'TV'} login created for ${merchant.email}`)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const toggleOrg = (id: string) =>
    setOrgIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const canSubmit = email.trim().length > 0 && password.length >= 8 && orgIds.length > 0 && !mutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    mutation.mutate({ email: email.trim(), password, org_ids: orgIds, role })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add store login</DialogTitle>
          <DialogDescription>
            Hand these credentials to the store. A TV login plays a location&apos;s content on the screen; a
            Manager login can run the console for the location(s) you pick and switch between them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="merchant-email">Email</Label>
            <Input
              id="merchant-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@merchant.com"
              autoComplete="off"
              autoFocus
              required
              disabled={mutation.isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merchant-password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="merchant-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required
                minLength={8}
                disabled={mutation.isPending}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Generate password"
                onClick={() => setPassword(generatePassword())}
                disabled={mutation.isPending}
              >
                <RefreshCwIcon />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Locations{orgIds.length > 0 ? ` (${orgIds.length})` : ''}</Label>
            <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-md border border-border p-1">
              {(orgsQuery.data ?? []).length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">No locations yet.</p>
              ) : (
                (orgsQuery.data ?? []).map((org) => {
                  const on = orgIds.includes(org.id)
                  return (
                    <button
                      type="button"
                      key={org.id}
                      onClick={() => toggleOrg(org.id)}
                      className={cn(
                        'flex items-center justify-between rounded px-2 py-1.5 text-left text-sm',
                        on ? 'bg-primary/10 font-medium' : 'hover:bg-muted',
                      )}
                    >
                      <span className="truncate">{org.name}</span>
                      {on ? <CheckIcon className="size-4 shrink-0 text-primary" /> : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Access</Label>
            <Select value={role} onValueChange={(v) => setRole(String(v) === 'admin' ? 'admin' : 'member')}>
              <SelectTrigger aria-label="Access level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">TV display only</SelectItem>
                <SelectItem value="admin">Manager — can use the console</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'admin'
                ? 'Signs in on a back-office computer to run the console and switch between its locations.'
                : 'Signs in only on the TV; cannot open the console.'}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? 'Creating…' : 'Create account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

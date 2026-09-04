'use client'

/**
 * components/admin/MerchantDialog.tsx — create a merchant TV account (addendum §13):
 * MTech types the email + password (handed to the merchant directly, no invite email)
 * and picks the organization whose content the TV will play.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
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
  const [orgId, setOrgId] = useState<string | null>(null)
  const [role, setRole] = useState<'member' | 'admin'>('member')

  useEffect(() => {
    if (open) {
      setEmail('')
      setPassword(generatePassword())
      setOrgId(null)
      setRole('member')
    }
  }, [open])

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: () => apiFetch<Organization[]>('/api/orgs'),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (input: { email: string; password: string; org_id: string; role: 'member' | 'admin' }) =>
      apiFetch<MerchantView>('/api/merchants', { method: 'POST', json: input }),
    onSuccess: (merchant) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      toast.success(`${merchant.role === 'admin' ? 'Manager' : 'TV'} login created for ${merchant.email}`)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const canSubmit = email.trim().length > 0 && password.length >= 8 && orgId !== null && !mutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || orgId === null) return
    mutation.mutate({ email: email.trim(), password, org_id: orgId, role })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add store login</DialogTitle>
          <DialogDescription>
            Hand these credentials to the store. A TV login plays the organization&apos;s content on
            the screen; a Manager login can also run the Screen Wall from a back-office computer.
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
            <Label>Organization</Label>
            <Select value={orgId ?? ''} onValueChange={(v) => setOrgId(String(v) || null)}>
              <SelectTrigger aria-label="Organization">
                <SelectValue placeholder="Pick the merchant's organization" />
              </SelectTrigger>
              <SelectContent>
                {(orgsQuery.data ?? []).map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Access</Label>
            <Select value={role} onValueChange={(v) => setRole(String(v) === 'admin' ? 'admin' : 'member')}>
              <SelectTrigger aria-label="Access level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">TV display only</SelectItem>
                <SelectItem value="admin">Manager — can use the Wall</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'admin'
                ? 'Signs in on a back-office computer to run the Screen Wall for this organization.'
                : 'Signs in only on the TV; cannot open this console.'}
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

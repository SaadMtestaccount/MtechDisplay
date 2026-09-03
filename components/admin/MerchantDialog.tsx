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

  useEffect(() => {
    if (open) {
      setEmail('')
      setPassword(generatePassword())
      setOrgId(null)
    }
  }, [open])

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: () => apiFetch<Organization[]>('/api/orgs'),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (input: { email: string; password: string; org_id: string }) =>
      apiFetch<MerchantView>('/api/merchants', { method: 'POST', json: input }),
    onSuccess: (merchant) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      toast.success(`Merchant account created for ${merchant.email}`)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const canSubmit = email.trim().length > 0 && password.length >= 8 && orgId !== null && !mutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || orgId === null) return
    mutation.mutate({ email: email.trim(), password, org_id: orgId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add merchant</DialogTitle>
          <DialogDescription>
            Hand these credentials to the merchant — they sign in on their TV and it starts playing
            their organization&apos;s content. Merchants cannot access this console.
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

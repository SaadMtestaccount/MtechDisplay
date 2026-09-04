'use client'

/**
 * components/admin/MerchantDialog.tsx — add a merchant (addendum §13). One step creates the
 * store's login AND its first location together: MTech types the email + password, names the
 * location, and picks the access level. More locations are added later from the merchant's row.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
  const [locationName, setLocationName] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')

  useEffect(() => {
    if (open) {
      setEmail('')
      setPassword(generatePassword())
      setLocationName('')
      setRole('member')
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (input: { email: string; password: string; location_name: string; role: 'member' | 'admin' }) =>
      apiFetch<MerchantView>('/api/merchants', { method: 'POST', json: input }),
    onSuccess: (merchant) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success(`Login created for ${merchant.email}`)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && locationName.trim().length > 0 && !mutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    mutation.mutate({ email: email.trim(), password, location_name: locationName.trim(), role })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add merchant</DialogTitle>
          <DialogDescription>
            Creates the store&apos;s login and its first location together. Hand the email and password to the
            store — a TV login plays that location&apos;s content; a Manager login can also open the console.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="merchant-location">Location name</Label>
            <Input
              id="merchant-location"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Downtown Store"
              autoComplete="off"
              autoFocus
              required
              disabled={mutation.isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="merchant-email">Login email</Label>
            <Input
              id="merchant-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@merchant.com"
              autoComplete="off"
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
              {mutation.isPending ? 'Creating…' : 'Create merchant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

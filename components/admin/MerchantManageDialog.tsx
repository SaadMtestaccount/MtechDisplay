'use client'

/**
 * components/admin/MerchantManageDialog.tsx — manage one merchant (addendum §13). Click a merchant
 * in Team to open this: see their locations, add a new location (optionally copying an existing
 * location's content + menus into it), or reset their password. One merchant = one login with one
 * or more locations.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPinIcon, PlusIcon, RefreshCwIcon } from 'lucide-react'
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
import type { MerchantView, OkResponse } from '@/types/api'

const NO_COPY = '__none__'
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generatePassword(): string {
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('')
}

export function MerchantManageDialog({
  merchant,
  open,
  onOpenChange,
}: {
  merchant: MerchantView | null
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const queryClient = useQueryClient()
  const [locations, setLocations] = useState<MerchantView['locations']>([])
  const [locationName, setLocationName] = useState('')
  const [copyFrom, setCopyFrom] = useState<string>(NO_COPY)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (open && merchant) {
      setLocations(merchant.locations)
      setLocationName('')
      setCopyFrom(NO_COPY)
      setNewPassword('')
    }
  }, [open, merchant])

  const addLocation = useMutation({
    mutationFn: (input: { location_name: string; copy_from_org_id?: string }) =>
      apiFetch<MerchantView>(`/api/merchants/${merchant?.id}/locations`, { method: 'POST', json: input }),
    onSuccess: (updated) => {
      setLocations(updated.locations)
      setLocationName('')
      setCopyFrom(NO_COPY)
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success('Location added')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const resetPassword = useMutation({
    mutationFn: (password: string) =>
      apiFetch<OkResponse>(`/api/merchants/${merchant?.id}/password`, { method: 'POST', json: { password } }),
    onSuccess: () => {
      toast.success('Password updated — hand the new one to the store')
      setNewPassword('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (locationName.trim().length === 0 || addLocation.isPending) return
    addLocation.mutate({
      location_name: locationName.trim(),
      copy_from_org_id: copyFrom === NO_COPY ? undefined : copyFrom,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{merchant?.email ?? 'Merchant'}</DialogTitle>
          <DialogDescription>
            {merchant?.role === 'admin' ? 'Manager login' : 'TV-only login'} · {locations.length}{' '}
            {locations.length === 1 ? 'location' : 'locations'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <Label>Locations</Label>
            <div className="flex flex-col gap-1 rounded-md border border-border p-1">
              {locations.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">No locations yet.</p>
              ) : (
                locations.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                    <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{l.name}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <Label className="text-sm font-medium">Add a location</Label>
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Uptown Store"
              autoComplete="off"
              disabled={addLocation.isPending}
            />
            {locations.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Copy content &amp; menus from</Label>
                <Select value={copyFrom} onValueChange={(v) => setCopyFrom(v ?? NO_COPY)}>
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
            <Button type="submit" size="sm" disabled={locationName.trim().length === 0 || addLocation.isPending}>
              <PlusIcon /> {addLocation.isPending ? 'Adding…' : 'Add location'}
            </Button>
          </form>

          <section className="flex flex-col gap-2">
            <Label htmlFor="reset-password">Reset password</Label>
            <div className="flex gap-2">
              <Input
                id="reset-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="off"
                minLength={8}
                disabled={resetPassword.isPending}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Generate password"
                onClick={() => setNewPassword(generatePassword())}
                disabled={resetPassword.isPending}
              >
                <RefreshCwIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetPassword.mutate(newPassword)}
                disabled={newPassword.length < 8 || resetPassword.isPending}
              >
                Save
              </Button>
            </div>
          </section>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

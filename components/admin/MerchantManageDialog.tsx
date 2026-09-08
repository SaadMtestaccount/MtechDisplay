'use client'

/**
 * components/admin/MerchantManageDialog.tsx — manage one merchant (CONTRACTS addendum §13, §19).
 * Click a merchant in Team to open this wide view: their locations side by side (rename, TV and
 * content counts, who can reach each, open it in the console), add a location (optionally copying
 * an existing one's content + menus), their employees (add / access / password / remove), and the
 * merchant's own password. Every write returns the refreshed MerchantView, kept in `view`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, RefreshCwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LocationPanel } from '@/components/admin/LocationPanel'
import { MerchantEmployees } from '@/components/admin/MerchantEmployees'
import { generatePassword } from '@/components/admin/password'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { MerchantView, OkResponse } from '@/types/api'

const NO_COPY = '__none__'

export function MerchantManageDialog({
  merchant,
  open,
  onOpenChange,
}: {
  merchant: MerchantView | null
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const router = useRouter()
  const { setActiveOrg } = useApp()
  const queryClient = useQueryClient()
  const [view, setView] = useState<MerchantView | null>(null)
  const [locationName, setLocationName] = useState('')
  const [copyFrom, setCopyFrom] = useState<string>(NO_COPY)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (open && merchant) {
      setView(merchant)
      setLocationName('')
      setCopyFrom(NO_COPY)
      setNewPassword('')
    }
  }, [open, merchant])

  const addLocation = useMutation({
    mutationFn: (input: { location_name: string; copy_from_org_id?: string }) =>
      apiFetch<MerchantView>(`/api/merchants/${merchant?.id}/locations`, { method: 'POST', json: input }),
    onSuccess: (updated) => {
      setView(updated)
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

  const openLocation = async (orgId: string) => {
    try {
      await setActiveOrg(orgId)
      onOpenChange(false)
      router.push('/tvs')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open that location')
    }
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (locationName.trim().length === 0 || addLocation.isPending) return
    addLocation.mutate({
      location_name: locationName.trim(),
      copy_from_org_id: copyFrom === NO_COPY ? undefined : copyFrom,
    })
  }

  const locations = view?.locations ?? []
  const employees = view?.employees ?? []
  // Labels for the copy-from select (Base UI's Select.Value shows raw values without them).
  const copyItems: Record<string, string> = {
    [NO_COPY]: 'Start empty',
    ...Object.fromEntries(locations.map((l) => [l.id, l.name] as const)),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{view?.email ?? 'Merchant'}</DialogTitle>
          <DialogDescription>
            {view?.role === 'admin' ? 'Manager login' : 'TV-only login'} · {locations.length}{' '}
            {locations.length === 1 ? 'location' : 'locations'} · {employees.length}{' '}
            {employees.length === 1 ? 'employee' : 'employees'}
          </DialogDescription>
        </DialogHeader>

        {view ? (
          <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto pr-1">
            <section className="flex flex-col gap-2">
              <Label>Locations</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {locations.map((l) => (
                  <LocationPanel
                    key={l.id}
                    location={l}
                    staff={employees.filter((e) => e.location_ids.includes(l.id))}
                    onOpen={() => void openLocation(l.id)}
                    onRenamed={(name) =>
                      setView({ ...view, locations: view.locations.map((x) => (x.id === l.id ? { ...x, name } : x)) })
                    }
                  />
                ))}
                <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
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
                  <Button
                    type="submit"
                    size="sm"
                    className="self-start"
                    disabled={locationName.trim().length === 0 || addLocation.isPending}
                  >
                    <PlusIcon /> {addLocation.isPending ? 'Adding…' : 'Add location'}
                  </Button>
                </form>
              </div>
            </section>

            <MerchantEmployees merchant={view} onUpdated={setView} />

            <section className="flex flex-col gap-2">
              <Label htmlFor="reset-password">Reset password (owner login)</Label>
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
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

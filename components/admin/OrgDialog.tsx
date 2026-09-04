'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { Organization } from '@/types/db'

/** Create (no `org`) or rename (`org` set) an organization. */
export function OrgDialog({
  open,
  onOpenChange,
  org,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  org?: Organization
}) {
  const isEdit = org !== undefined
  const [name, setName] = useState(org?.name ?? '')
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    if (open) setName(org?.name ?? '')
  }, [open, org])

  const mutation = useMutation({
    mutationFn: (input: { name: string }) =>
      isEdit
        ? apiFetch<Organization>(`/api/orgs/${org.id}`, { method: 'PATCH', json: input })
        : apiFetch<Organization>('/api/orgs', { method: 'POST', json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success(isEdit ? 'Organization renamed' : 'Organization created')
      onOpenChange(false)
      // The org list in the navbar comes from the server layout — refresh it.
      router.refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || mutation.isPending) return
    mutation.mutate({ name: trimmed })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Rename location' : 'New location'}</DialogTitle>
          {!isEdit ? (
            <DialogDescription>Each location has its own TVs, menus and content.</DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Street"
              maxLength={120}
              autoFocus
              disabled={mutation.isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

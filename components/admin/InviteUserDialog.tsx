'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import type { UserView } from '@/types/api'

/** Invite MTech staff by email — the invitee arrives as a super admin (spec §15). */
export function InviteUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const [email, setEmail] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) setEmail('')
  }, [open])

  const mutation = useMutation({
    mutationFn: (input: { email: string }) =>
      apiFetch<UserView>('/api/users', { method: 'POST', json: input }),
    onSuccess: (invited) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
      toast.success(`Invite sent to ${invited.email}`)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || mutation.isPending) return
    mutation.mutate({ email: trimmed })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            They receive an email invite and join as MTech staff with super-admin access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@mtechdistributors.com"
              autoComplete="off"
              autoFocus
              required
              disabled={mutation.isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending || !email.trim()}>
              {mutation.isPending ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

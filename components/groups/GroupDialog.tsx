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
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { GroupView } from '@/types/api'

/**
 * Create (no `group`) or rename (`group` set) a screen group. On create the server also
 * creates the group playlist; GroupsBoard passes `onCreated` → router.push to the editor.
 */
export function GroupDialog({
  open,
  onOpenChange,
  group,
  onCreated,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  group?: GroupView
  onCreated?(g: GroupView): void
}) {
  const isEdit = group !== undefined
  const { org } = useApp()
  const queryClient = useQueryClient()
  const [name, setName] = useState(group?.name ?? '')
  const orgId = org?.id ?? null

  useEffect(() => {
    if (open) setName(group?.name ?? '')
  }, [open, group])

  const mutation = useMutation({
    mutationFn: (input: { name: string }) =>
      group
        ? apiFetch<GroupView>(`/api/groups/${group.id}`, { method: 'PATCH', json: input })
        : apiFetch<GroupView>('/api/groups', { method: 'POST', json: input }),
    onSuccess: (g) => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all(orgId) })
      toast.success(isEdit ? 'Group renamed' : 'Group created')
      onOpenChange(false)
      if (!isEdit) onCreated?.(g)
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
          <DialogTitle>{isEdit ? 'Rename group' : 'New screen group'}</DialogTitle>
          {!isEdit ? (
            <DialogDescription>
              A group has one playlist that plays on every screen you assign to it.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Menu Boards"
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

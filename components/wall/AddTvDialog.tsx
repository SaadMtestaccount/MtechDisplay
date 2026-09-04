'use client'

/** components/wall/AddTvDialog.tsx — name a new TV; on create the caller shows its login code. */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { ScreenView } from '@/types/api'

export function AddTvDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onCreated(screen: ScreenView): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  useEffect(() => {
    if (open) setName('')
  }, [open])

  const mutation = useMutation({
    mutationFn: (value: string) => apiFetch<ScreenView>('/api/screens', { method: 'POST', json: { name: value } }),
    onSuccess: (screen) => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      onOpenChange(false)
      onCreated(screen)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = name.trim()
    if (!value || mutation.isPending) return
    mutation.mutate(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a TV</DialogTitle>
          <DialogDescription>Name it (like “Front Window”). You’ll get a code to type on the TV.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tv-name">Name</Label>
            <Input
              id="tv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front Window"
              autoFocus
              required
              disabled={mutation.isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? 'Adding…' : 'Add TV'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

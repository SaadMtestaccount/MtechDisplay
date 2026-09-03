'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { FolderView } from '@/types/api'

/** Creates a folder via POST /api/folders (docs/CONTRACTS.md §9.2). */
export function NewFolderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onCreated?(f: FolderView): void
}) {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) setName('')
  }, [open])

  const mutation = useMutation({
    mutationFn: (input: { name: string }) => apiFetch<FolderView>('/api/folders', { method: 'POST', json: input }),
    onSuccess: (folder) => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all(orgId) })
      toast.success('Folder created')
      onOpenChange(false)
      onCreated?.(folder)
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
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Promotions"
              maxLength={120}
              autoFocus
              disabled={mutation.isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

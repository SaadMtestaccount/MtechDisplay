'use client'

/** components/menus/MenuDialog.tsx — create a menu (→ open its editor) or rename one. */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { MenuView } from '@/types/api'
import type { Playlist } from '@/types/db'

export function MenuDialog({
  open,
  onOpenChange,
  menu,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  menu?: MenuView
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const isEdit = menu !== undefined

  useEffect(() => {
    if (open) setName(menu?.name ?? '')
  }, [open, menu])

  const mutation = useMutation({
    mutationFn: (value: string) =>
      isEdit
        ? apiFetch<Playlist>(`/api/menus/${menu.id}`, { method: 'PATCH', json: { name: value } })
        : apiFetch<Playlist>('/api/menus', { method: 'POST', json: { name: value } }),
    onSuccess: (saved) => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all(org.id) })
      toast.success(isEdit ? 'Menu renamed' : 'Menu created')
      onOpenChange(false)
      if (!isEdit) router.push(`/menus/${saved.id}`)
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
          <DialogTitle>{isEdit ? 'Rename menu' : 'New menu'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="menu-name">Name</Label>
            <Input
              id="menu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fall Menu"
              autoFocus
              required
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

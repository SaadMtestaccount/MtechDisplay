'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { ContentView, FolderView } from '@/types/api'

const UNFILED = 'root'

/** Moves an item into a folder (or back to Unfiled) via PATCH /api/content/[id]. */
export function MoveDialog({
  item,
  folders,
  onOpenChange,
}: {
  item: ContentView | null
  folders: FolderView[]
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()
  const [value, setValue] = useState<string>(UNFILED)

  useEffect(() => {
    if (item) setValue(item.folder_id ?? UNFILED)
  }, [item])

  const mutation = useMutation({
    mutationFn: (folder_id: string | null) =>
      apiFetch<ContentView>(`/api/content/${item?.id}`, { method: 'PATCH', json: { folder_id } }),
    onSuccess: (view) => {
      if (orgId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.content.all(orgId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all(orgId) })
      }
      toast.success(view.folder_name ? `Moved to ${view.folder_name}` : 'Moved to Unfiled')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="move-folder">Folder for {item?.name}</Label>
          <Select value={value} onValueChange={(v) => setValue(String(v))}>
            <SelectTrigger id="move-folder" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNFILED}>Unfiled</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(value === UNFILED ? null : value)}
          >
            {mutation.isPending ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

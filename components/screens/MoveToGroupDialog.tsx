'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { GroupSelect } from '@/components/screens/GroupSelect'
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
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { GroupView, ScreenView } from '@/types/api'

/** Assign the screen to a group (it then plays the group playlist) or pick "No group". */
export function MoveToGroupDialog({
  screen,
  groups,
  onOpenChange,
}: {
  screen: ScreenView | null
  groups: GroupView[]
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const [groupId, setGroupId] = useState<string | null>(null)

  useEffect(() => {
    if (screen) setGroupId(screen.group_id)
  }, [screen])

  const mutation = useMutation({
    mutationFn: (input: { id: string; group_id: string | null }) =>
      apiFetch<ScreenView>(`/api/screens/${input.id}`, { method: 'PATCH', json: { group_id: input.group_id } }),
    onSuccess: (_screen, input) => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      toast.success(input.group_id ? 'Moved to group' : 'Removed from group')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <Dialog open={screen !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to group</DialogTitle>
          <DialogDescription>
            A grouped screen plays its group&apos;s playlist instead of its own.
          </DialogDescription>
        </DialogHeader>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No groups yet — create one on the Groups page first.
          </p>
        ) : (
          <GroupSelect value={groupId} groups={groups} onChange={setGroupId} />
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button
            disabled={mutation.isPending || !screen || groups.length === 0}
            onClick={() => {
              if (screen) mutation.mutate({ id: screen.id, group_id: groupId })
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

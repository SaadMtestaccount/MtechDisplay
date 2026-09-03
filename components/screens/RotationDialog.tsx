'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RotationSelect } from '@/components/screens/RotationSelect'
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
import { isRotation } from '@/lib/utils'
import type { Rotation, ScreenView } from '@/types/api'

/** The card's 'rotation' action: RotationSelect + Save → PATCH { rotation }. */
export function RotationDialog({
  screen,
  onOpenChange,
}: {
  screen: ScreenView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const [rotation, setRotation] = useState<Rotation>(0)

  useEffect(() => {
    if (screen) setRotation(isRotation(screen.rotation) ? screen.rotation : 0)
  }, [screen])

  const mutation = useMutation({
    mutationFn: (input: { id: string; rotation: Rotation }) =>
      apiFetch<ScreenView>(`/api/screens/${input.id}`, { method: 'PATCH', json: { rotation: input.rotation } }),
    onSuccess: () => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      toast.success('Rotation updated')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <Dialog open={screen !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Screen rotation</DialogTitle>
          <DialogDescription>
            Match how the TV is physically mounted. The player rotates its output to fit.
          </DialogDescription>
        </DialogHeader>
        <RotationSelect value={rotation} onChange={setRotation} disabled={mutation.isPending} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button
            disabled={mutation.isPending || !screen}
            onClick={() => {
              if (screen) mutation.mutate({ id: screen.id, rotation })
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { OrientationSelect } from '@/components/screens/OrientationSelect'
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
import { Label } from '@/components/ui/label'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { isOrientation, isRotation } from '@/lib/utils'
import type { Orientation, Rotation, ScreenView } from '@/types/api'

/** The card's 'rotation' action: Orientation + Rotation selects + Save → PATCH { orientation, rotation }. */
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
  const [orientation, setOrientation] = useState<Orientation>('landscape')

  useEffect(() => {
    if (!screen) return
    setRotation(isRotation(screen.rotation) ? screen.rotation : 0)
    setOrientation(isOrientation(screen.orientation) ? screen.orientation : 'landscape')
  }, [screen])

  const mutation = useMutation({
    mutationFn: (input: { id: string; rotation: Rotation; orientation: Orientation }) =>
      apiFetch<ScreenView>(`/api/screens/${input.id}`, {
        method: 'PATCH',
        json: { rotation: input.rotation, orientation: input.orientation },
      }),
    onSuccess: () => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      toast.success('Display updated')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <Dialog open={screen !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Display orientation</DialogTitle>
          <DialogDescription>
            Portrait shows an upright vertical canvas — for tall menus, or a browser window on a vertical
            monitor. Rotation matches how a TV is physically mounted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Orientation</Label>
            <OrientationSelect value={orientation} onChange={setOrientation} disabled={mutation.isPending} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rotation</Label>
            <RotationSelect value={rotation} onChange={setRotation} disabled={mutation.isPending} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button
            disabled={mutation.isPending || !screen}
            onClick={() => {
              if (screen) mutation.mutate({ id: screen.id, rotation, orientation })
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

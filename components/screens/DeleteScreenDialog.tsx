'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OkResponse, ScreenView } from '@/types/api'

/**
 * Destructive confirm → DELETE /api/screens/{id}. Deleting revokes the device token, so the
 * TV returns to its pairing screen. When confirmed from the screen's own detail page,
 * navigates back to /screens.
 */
export function DeleteScreenDialog({
  screen,
  onOpenChange,
}: {
  screen: ScreenView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()

  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<OkResponse>(`/api/screens/${id}`, { method: 'DELETE' }),
    onSuccess: (_ok, id) => {
      toast.success('Screen deleted')
      onOpenChange(false)
      if (pathname === `/screens/${id}`) router.push('/screens')
      if (org) {
        queryClient.removeQueries({ queryKey: queryKeys.screens.detail(org.id, id) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <ConfirmDialog
      open={screen !== null}
      onOpenChange={onOpenChange}
      title={screen ? `Delete "${screen.name}"?` : 'Delete screen'}
      description="This permanently removes the screen and its playlist. The paired TV is unpaired and returns to its pairing screen."
      confirmLabel="Delete screen"
      destructive
      loading={mutation.isPending}
      onConfirm={() => {
        if (screen && !mutation.isPending) mutation.mutate(screen.id)
      }}
    />
  )
}

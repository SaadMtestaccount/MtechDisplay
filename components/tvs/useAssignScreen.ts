'use client'

/**
 * components/tvs/useAssignScreen.ts — "show X on this TV" for the merchant console
 * (docs/CONTRACTS.md §23). Merchants never see the lock: a pinned TV is unlocked first, then
 * assigned, so the change always lands. Invalidates the org's screens and toasts.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { AssignScreenInput } from '@/lib/validators/screens'
import type { ScreenView } from '@/types/api'

export type AssignArgs = { screen: Pick<ScreenView, 'id' | 'name' | 'locked'>; body: AssignScreenInput; label?: string }

export async function assignUnlocked({ screen, body }: AssignArgs): Promise<ScreenView> {
  if (screen.locked) {
    await apiFetch<ScreenView>(`/api/screens/${screen.id}`, { method: 'PATCH', json: { locked: false } })
  }
  return apiFetch<ScreenView>(`/api/screens/${screen.id}/assign`, { method: 'POST', json: body })
}

export function useAssignScreen({ onDone }: { onDone?(screen: ScreenView): void } = {}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: assignUnlocked,
    onSuccess: (screen, { body, label }) => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      toast.success(
        body.kind === 'clear'
          ? `${screen.name} now shows nothing`
          : `${screen.name} now shows ${label ?? 'the new pick'}`,
      )
      onDone?.(screen)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })
}

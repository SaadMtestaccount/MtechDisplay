'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { dateInZone, endOfDayInZone } from '@/lib/schedule'
import { fromDateString, toDateString } from '@/lib/utils'
import type { ContentView } from '@/types/api'

/**
 * Expiration picker (docs/CONTRACTS.md §9.2, §5.11): a picked calendar day D is stored as
 * `endOfDayInZone(D, org.timezone)` — the item plays through the end of that day in the org's
 * zone. Clear removes the expiration. Picking a past day yields an immediate Expired badge.
 */
export function ExpirationDialog({
  item,
  onOpenChange,
}: {
  item: ContentView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const timezone = org?.timezone ?? 'UTC'
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Date | undefined>(undefined)

  useEffect(() => {
    if (item) setSelected(item.expires_at ? fromDateString(dateInZone(item.expires_at, timezone)) : undefined)
  }, [item, timezone])

  const mutation = useMutation({
    mutationFn: (expires_at: string | null) =>
      apiFetch<ContentView>(`/api/content/${item?.id}`, { method: 'PATCH', json: { expires_at } }),
    onSuccess: (_view, expires_at) => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.content.all(orgId) })
      toast.success(expires_at === null ? 'Expiration cleared' : 'Expiration set')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle>Set expiration</DialogTitle>
          <DialogDescription>
            {item?.name} plays through the end of the picked day ({timezone}), then stops showing on screens.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <Calendar mode="single" selected={selected} onSelect={(date) => setSelected(date ?? undefined)} />
        </div>
        <DialogFooter>
          {item?.expires_at ? (
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(null)}
            >
              Clear expiration
            </Button>
          ) : null}
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button
            type="button"
            disabled={mutation.isPending || selected === undefined}
            onClick={() => {
              if (selected) mutation.mutate(endOfDayInZone(toDateString(selected), timezone))
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

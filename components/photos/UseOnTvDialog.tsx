'use client'

/**
 * components/photos/UseOnTvDialog.tsx — put one photo/video on a TV (docs/CONTRACTS.md §23):
 * radio list of the location's TVs, one button. Goes through useAssignScreen (unlock + assign).
 */
import { useQuery } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatusPill } from '@/components/shell/StatusPill'
import { tvShowing } from '@/components/tvs/tv-copy'
import { useAssignScreen } from '@/components/tvs/useAssignScreen'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus, screenStatus } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { ContentView, ScreenView } from '@/types/api'

export function UseOnTvDialog({ item, onOpenChange }: { item: ContentView | null; onOpenChange(open: boolean): void }) {
  const { org } = useApp()
  const orgId = org?.id ?? ''
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => setSelectedId(null), [item?.id])

  const screensQuery = useQuery({
    queryKey: queryKeys.screens.list(orgId, { sort: 'name' }),
    queryFn: () => apiFetch<ScreenView[]>('/api/screens?sort=name'),
    enabled: item !== null && orgId !== '',
  })
  const screens = (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now))
  const chosen = screens.find((s) => s.id === selectedId) ?? null
  const assign = useAssignScreen({ onDone: () => onOpenChange(false) })

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Which TV?</DialogTitle>
          <DialogDescription className="text-[15px]">
            {item ? `${item.name} will be the only thing on that TV.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 py-1" role="radiogroup">
          {screensQuery.isPending ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading your TVs…</p>
          ) : screens.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-muted-foreground">You have no TVs yet. Add one on the TVs page.</p>
          ) : (
            screens.map((s) => {
              const on = s.id === selectedId
              const showing = tvShowing(s)
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'flex h-16 items-center gap-3 rounded-xl border-2 px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-semibold">{s.name}</span>
                      <StatusPill status={screenStatus(s)} />
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {showing.kind === 'nothing' ? 'Showing nothing' : `Showing ${showing.name}`}
                    </div>
                  </div>
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary bg-primary text-white' : 'border-border')}>
                    {on ? <CheckIcon className="size-4" /> : null}
                  </span>
                </button>
              )
            })
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="lg" type="button" />}>Cancel</DialogClose>
          <Button
            size="lg"
            disabled={!chosen || !item || assign.isPending}
            onClick={() => {
              if (chosen && item) assign.mutate({ screen: chosen, body: { kind: 'content', content_id: item.id }, label: item.name })
            }}
          >
            {assign.isPending ? 'Sending…' : chosen ? `Show on ${chosen.name}` : 'Show on this TV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

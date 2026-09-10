'use client'

/**
 * components/menus/MenuScreensCard.tsx — "Which TVs show this menu" (docs/CONTRACTS.md §23):
 * a checklist of the location's TVs (checked = screens.menu_id === this menu) with one Save
 * button. Ticking assigns the menu (unlocking first); un-ticking clears the TV (it shows
 * nothing until something else is picked). Below it: the "play together" (sync) switch.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { assignUnlocked } from '@/components/tvs/useAssignScreen'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { useRealtimeScreens } from '@/hooks/useRealtimeScreens'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { mergeScreenStatus, screenStatus } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { PlaylistView, ScreenView } from '@/types/api'

export function MenuScreensCard({ menu }: { menu: PlaylistView }) {
  const { org } = useApp()
  const orgId = org?.id ?? ''
  const queryClient = useQueryClient()
  const { statuses } = useRealtimeScreens()
  const now = useNow(5000)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [sync, setSync] = useState(menu.sync)

  const screensQuery = useQuery({
    queryKey: queryKeys.screens.list(orgId, { sort: 'name' }),
    queryFn: () => apiFetch<ScreenView[]>('/api/screens?sort=name'),
    enabled: orgId !== '',
  })
  const screens = (screensQuery.data ?? []).map((s) => mergeScreenStatus(s, statuses[s.id], now))
  const serverChecked = new Set(screens.filter((s) => s.menu_id === menu.id).map((s) => s.id))
  const serverKey = Array.from(serverChecked).sort().join(',')

  // Follow the server whenever the assignment set changes (initial load, other tabs, saves).
  useEffect(() => {
    setChecked(new Set(serverKey ? serverKey.split(',') : []))
  }, [serverKey])
  useEffect(() => setSync(menu.sync), [menu.sync])

  const dirty =
    Array.from(checked).sort().join(',') !== serverKey

  const save = useMutation({
    mutationFn: async () => {
      const turnOn = screens.filter((s) => checked.has(s.id) && !serverChecked.has(s.id))
      const turnOff = screens.filter((s) => !checked.has(s.id) && serverChecked.has(s.id))
      await Promise.all([
        ...turnOn.map((s) => assignUnlocked({ screen: s, body: { kind: 'menu', menu_id: menu.id } })),
        ...turnOff.map((s) => assignUnlocked({ screen: s, body: { kind: 'clear' } })),
      ])
      return { on: turnOn.length, off: turnOff.length }
    },
    onSuccess: ({ on, off }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all(orgId) })
      const parts = []
      if (on > 0) parts.push(`now on ${on} more ${on === 1 ? 'TV' : 'TVs'}`)
      if (off > 0) parts.push(`removed from ${off} ${off === 1 ? 'TV' : 'TVs'}`)
      toast.success(`${menu.name} ${parts.join(' and ')}`)
    },
    onError: (e) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    },
  })

  const syncMutation = useMutation({
    mutationFn: (next: boolean) =>
      apiFetch<PlaylistView>(`/api/playlists/${menu.id}`, { method: 'PATCH', json: { sync: next } }),
    onMutate: (next) => setSync(next),
    onSuccess: (view) => {
      setSync(view.sync)
      void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all(orgId) })
      toast.success(view.sync ? 'The TVs showing this menu now play together' : 'Each TV plays on its own again')
    },
    onError: (e, next) => {
      setSync(!next)
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    },
  })

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Which TVs show this menu</h2>
        {screensQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading your TVs…</p>
        ) : screens.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">You have no TVs yet. Add one on the TVs page.</p>
        ) : (
          screens.map((s) => {
            const on = checked.has(s.id)
            const status = screenStatus(s)
            const other = !on && s.menu_name && s.menu_id !== menu.id ? `showing ${s.menu_name}` : null
            return (
              <button
                key={s.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(s.id)}
                className={cn(
                  'flex h-14 items-center gap-3 rounded-xl border-2 px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md border-2',
                    on ? 'border-primary bg-primary text-white' : 'border-border',
                  )}
                >
                  {on ? <CheckIcon className="size-4" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{s.name}</span>
                <span className={cn('truncate text-sm', status === 'offline' ? 'text-offline' : 'text-muted-foreground')}>
                  {status === 'offline' ? 'off' : status === 'unpaired' ? 'not signed in' : other}
                </span>
              </button>
            )
          })
        )}
        <Button size="xl" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-bold">Play the same thing on every TV at once?</span>
            <span className="text-sm text-muted-foreground">
              Turn this on so the TVs showing this menu stay in step, like one big screen.
            </span>
          </div>
          <Switch
            checked={sync}
            onCheckedChange={(v) => syncMutation.mutate(v)}
            disabled={syncMutation.isPending}
            aria-label="Play together"
            className="scale-150"
          />
        </div>
      </div>
    </div>
  )
}

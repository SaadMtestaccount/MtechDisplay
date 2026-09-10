'use client'

/**
 * components/tvs/TvTools.tsx — the small things you can do to one TV (docs/CONTRACTS.md §23):
 * Restart, Flash its name, Sideways/Upright, Show nothing, Watch it here, Sign-in code, Remove.
 * MTech staff get a second row: badge position, play in sync, rotation, lock, advanced page.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  KeyRoundIcon, LockIcon, MaximizeIcon, MegaphoneIcon, MonitorOffIcon, MoveIcon, RadioIcon, RefreshCwIcon,
  RectangleHorizontalIcon, RectangleVerticalIcon, SettingsIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { DeleteScreenDialog } from '@/components/screens/DeleteScreenDialog'
import { RotationSelect } from '@/components/screens/RotationSelect'
import { useAssignScreen } from '@/components/tvs/useAssignScreen'
import { Button } from '@/components/ui/button'
import { ScreenCodeDialog } from '@/components/wall/ScreenCodeDialog'
import { WatermarkPositionDialog } from '@/components/wall/WatermarkPositionDialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { formatLoginCode } from '@/lib/utils'
import type { ScreenUpdateInput } from '@/lib/validators/screens'
import type { OkResponse, ScreenAction, ScreenView } from '@/types/api'

export function TvTools({ screen }: { screen: ScreenView }) {
  const { org, profile } = useApp()
  const queryClient = useQueryClient()
  const [codeOpen, setCodeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [badgeOpen, setBadgeOpen] = useState(false)
  const invalidate = () => {
    if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
  }
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong')

  const action = useMutation({
    mutationFn: (a: ScreenAction) =>
      apiFetch<OkResponse>(`/api/screens/${screen.id}/actions`, { method: 'POST', json: { action: a } }),
    onSuccess: (_ok, a) =>
      toast.success(a === 'identify' ? `${screen.name} shows its name for a few seconds` : `Restarting ${screen.name}`),
    onError: fail,
  })
  const patch = useMutation({
    mutationFn: (input: ScreenUpdateInput) =>
      apiFetch<ScreenView>(`/api/screens/${screen.id}`, { method: 'PATCH', json: input }),
    onSuccess: (updated, input) => {
      invalidate()
      if (input.orientation !== undefined) toast.success(updated.orientation === 'portrait' ? 'Now sideways (vertical)' : 'Now upright (wide)')
      else if (input.sync !== undefined) toast.success(updated.sync ? 'Plays in sync with the other synced TVs' : 'Sync turned off')
      else if (input.locked !== undefined) toast.success(updated.locked ? 'Locked' : 'Unlocked')
      else if (input.rotation !== undefined) toast.success('Rotation updated')
    },
    onError: fail,
  })
  const clear = useAssignScreen()

  const portrait = screen.orientation === 'portrait'
  const OrientIcon = portrait ? RectangleHorizontalIcon : RectangleVerticalIcon
  const busy = action.isPending || patch.isPending || clear.isPending

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-bold">TV tools</h2>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" disabled={!screen.paired || busy} onClick={() => action.mutate('reload')}>
          <RefreshCwIcon /> Restart TV
        </Button>
        <Button variant="outline" size="lg" disabled={!screen.paired || busy} onClick={() => action.mutate('identify')}>
          <MegaphoneIcon /> Flash its name
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => patch.mutate({ orientation: portrait ? 'landscape' : 'portrait' })}
        >
          <OrientIcon /> {portrait ? 'Make it wide' : 'Make it vertical'}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => clear.mutate({ screen, body: { kind: 'clear' } })}
        >
          <MonitorOffIcon /> Show nothing
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={!screen.login_code}
          onClick={() => window.open(`/player?code=${screen.login_code ?? ''}`, '_blank', 'noopener')}
        >
          <MaximizeIcon /> Watch it here
        </Button>
        <Button variant="outline" size="lg" onClick={() => setCodeOpen(true)}>
          <KeyRoundIcon /> Sign-in code
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Sign-in code: <strong className="font-mono tracking-widest text-foreground">{formatLoginCode(screen.login_code) || '—'}</strong>
        </span>
        <button type="button" onClick={() => setDeleteOpen(true)} className="font-semibold text-destructive hover:underline">
          Remove this TV
        </button>
      </div>

      {profile.is_super_admin ? (
        <div className="mt-1 flex flex-col gap-2 rounded-xl bg-warning-soft/60 p-3">
          <span className="eyebrow">MTech staff</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBadgeOpen(true)}>
              <MoveIcon /> Move the MTech badge
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => patch.mutate({ sync: !screen.sync })}>
              <RadioIcon /> {screen.sync ? 'Sync: on' : 'Sync: off'}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => patch.mutate({ locked: !screen.locked })}>
              <LockIcon /> {screen.locked ? 'Locked' : 'Unlocked'}
            </Button>
            <RotationSelect value={screen.rotation} onChange={(rotation) => patch.mutate({ rotation })} disabled={busy} />
            <Button variant="ghost" size="sm" render={<Link href={`/screens/${screen.id}`} />}>
              <SettingsIcon /> Advanced
            </Button>
          </div>
        </div>
      ) : null}

      <ScreenCodeDialog screen={codeOpen ? screen : null} onOpenChange={setCodeOpen} />
      <DeleteScreenDialog screen={deleteOpen ? screen : null} onOpenChange={setDeleteOpen} />
      {profile.is_super_admin ? (
        <WatermarkPositionDialog screen={badgeOpen ? screen : null} onOpenChange={setBadgeOpen} />
      ) : null}
    </div>
  )
}

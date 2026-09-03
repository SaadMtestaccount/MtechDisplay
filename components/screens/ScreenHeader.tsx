'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MegaphoneIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DeleteScreenDialog } from '@/components/screens/DeleteScreenDialog'
import { DeviceInfo } from '@/components/screens/DeviceInfo'
import { GroupSelect } from '@/components/screens/GroupSelect'
import { NowPlayingChip } from '@/components/screens/NowPlayingChip'
import { RotationSelect } from '@/components/screens/RotationSelect'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { StatusPill } from '@/components/shell/StatusPill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { screenStatus } from '@/lib/status'
import { relativeTime } from '@/lib/utils'
import type { ScreenUpdateInput } from '@/lib/validators/screens'
import type { GroupView, OkResponse, ScreenAction, ScreenDetailView, ScreenView } from '@/types/api'

/**
 * Detail header: inline-editable name, StatusPill, ticking last seen, DeviceInfo,
 * RotationSelect / GroupSelect (PATCH + toast), Identify/Reload, NowPlayingChip, delete.
 * `screen` is the realtime-merged view (ScreenDetail merges before rendering).
 */
export function ScreenHeader({
  screen,
  groups,
  now,
}: {
  screen: ScreenDetailView
  groups: GroupView[]
  now: Date
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const status = screenStatus(screen)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(screen.name)
  const cancelRef = useRef(false)
  const [deleteTarget, setDeleteTarget] = useState<ScreenView | null>(null)

  useEffect(() => {
    if (!editing) setName(screen.name)
  }, [screen.name, editing])

  const patch = useMutation({
    mutationFn: (input: ScreenUpdateInput) =>
      apiFetch<ScreenView>(`/api/screens/${screen.id}`, { method: 'PATCH', json: input }),
    onSuccess: (_screen, input) => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      if (input.name !== undefined) toast.success('Screen renamed')
      else if (input.rotation !== undefined) toast.success('Rotation updated')
      else if (input.group_id !== undefined) toast.success(input.group_id ? 'Moved to group' : 'Removed from group')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const action = useMutation({
    mutationFn: (a: ScreenAction) =>
      apiFetch<OkResponse>(`/api/screens/${screen.id}/actions`, { method: 'POST', json: { action: a } }),
    onSuccess: (_ok, a) =>
      toast.success(a === 'identify' ? 'Identify sent — the TV shows its name for a few seconds' : 'Reload sent'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const finishRename = () => {
    setEditing(false)
    if (cancelRef.current) {
      cancelRef.current = false
      setName(screen.name)
      return
    }
    const trimmed = name.trim()
    if (!trimmed || trimmed === screen.name) {
      setName(screen.name)
      return
    }
    patch.mutate({ name: trimmed })
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  cancelRef.current = true
                  e.currentTarget.blur()
                }
              }}
              maxLength={120}
              autoFocus
              aria-label="Screen name"
              className="h-9 w-72 text-xl font-semibold tracking-[-0.02em]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Click to rename"
              className="max-w-full cursor-text truncate rounded-md text-left text-2xl leading-[1.05] font-semibold tracking-[-0.02em] outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {screen.name}
            </button>
          )}
          <StatusPill status={status} size="md" />
        </div>
        <div className="text-sm text-muted-foreground">
          {status === 'unpaired' ? 'Never paired' : `Last seen ${relativeTime(screen.last_seen_at, now)}`}
        </div>
        <DeviceInfo screen={screen} />
        <NowPlayingChip item={screen.current_item} online={screen.online} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RotationSelect
          value={screen.rotation}
          onChange={(rotation) => patch.mutate({ rotation })}
          disabled={patch.isPending}
        />
        <GroupSelect
          value={screen.group_id}
          groups={groups}
          onChange={(group_id) => patch.mutate({ group_id })}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!screen.paired || action.isPending}
          onClick={() => action.mutate('identify')}
        >
          <MegaphoneIcon />
          Identify
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!screen.paired || action.isPending}
          onClick={() => action.mutate('reload')}
        >
          <RefreshCwIcon />
          Reload
        </Button>
        <KebabMenu
          items={[
            {
              label: 'Delete screen',
              icon: <Trash2Icon />,
              destructive: true,
              onSelect: () => setDeleteTarget(screen),
            },
          ]}
        />
      </div>
      <DeleteScreenDialog
        screen={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

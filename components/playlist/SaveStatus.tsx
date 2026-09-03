'use client'

import { CircleAlertIcon, CircleCheckIcon, Loader2Icon } from 'lucide-react'
import { useNow } from '@/hooks/useNow'
import type { PlaylistAutosaveStatus } from '@/hooks/usePlaylistAutosave'
import { cn, relativeTime } from '@/lib/utils'

/**
 * Autosave indicator (docs/CONTRACTS.md §9.5): "Unsaved changes" while dirty, "Saving…",
 * "Saved {relative}", "Save failed". Renders nothing before the first edit ('idle').
 */
export function SaveStatus({
  status,
  lastSavedAt,
}: {
  status: PlaylistAutosaveStatus
  lastSavedAt: Date | null
}) {
  const now = useNow(5000)
  if (status === 'idle') return null

  const label =
    status === 'dirty'
      ? 'Unsaved changes'
      : status === 'saving'
        ? 'Saving…'
        : status === 'error'
          ? 'Save failed'
          : lastSavedAt
            ? `Saved ${relativeTime(lastSavedAt, now)}`
            : 'Saved'

  return (
    <span
      role="status"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-xs',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {status === 'saving' ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
      {status === 'saved' ? <CircleCheckIcon className="size-3.5 text-online" /> : null}
      {status === 'error' ? <CircleAlertIcon className="size-3.5" /> : null}
      {label}
    </span>
  )
}

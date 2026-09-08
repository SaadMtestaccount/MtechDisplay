import { cn } from '@/lib/utils'
import type { ScreenPresence } from '@/types/api'

const LABELS: Record<ScreenPresence, string> = {
  online: 'Online',
  offline: 'Offline',
  unpaired: 'Not paired',
}

// Opaque pastel fills (not alpha tints): the pill also sits on top of TV thumbnails.
const STYLES: Record<ScreenPresence, string> = {
  online: 'bg-online-soft text-online',
  offline: 'bg-offline-soft text-offline',
  unpaired: 'bg-muted text-muted-foreground',
}

const DOTS: Record<ScreenPresence, string> = {
  online: 'bg-online',
  offline: 'bg-offline',
  unpaired: 'bg-muted-foreground',
}

/** Callers pass `screenStatus(view)` from lib/status.ts — never a raw boolean. */
export function StatusPill({
  status,
  size = 'sm',
  className,
}: {
  status: ScreenPresence
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium',
        STYLES[status],
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOTS[status])} />
      {LABELS[status]}
    </span>
  )
}

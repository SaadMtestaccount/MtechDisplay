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
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold ring-1 ring-black/[0.04] ring-inset',
        STYLES[status],
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs',
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {status === 'online' ? (
          <span
            className="absolute inset-0 rounded-full bg-online motion-safe:animate-[status-pulse_2.4s_ease-in-out_infinite]"
            aria-hidden
          />
        ) : null}
        <span className={cn('relative size-1.5 rounded-full', DOTS[status])} />
      </span>
      {LABELS[status]}
    </span>
  )
}

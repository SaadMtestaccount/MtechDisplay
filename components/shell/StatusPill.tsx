import { cn } from '@/lib/utils'
import type { ScreenPresence } from '@/types/api'

const LABELS: Record<ScreenPresence, string> = {
  online: 'Online',
  offline: 'Offline',
  unpaired: 'Not paired',
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
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/85 font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-sm',
        size === 'sm' ? 'h-5 px-2 text-[10px]' : 'h-6 px-2.5 text-[11px]',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOTS[status])} />
      {LABELS[status]}
    </span>
  )
}

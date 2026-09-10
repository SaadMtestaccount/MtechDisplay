'use client'

/**
 * components/tvs/TvCard.tsx — one TV on the merchant TVs page (docs/CONTRACTS.md §23): big
 * thumbnail, name + status, one sentence about what it shows, ONE button. The button depends
 * on the state: on → "Change what's showing", off → "How to fix this", not signed in →
 * "Get the sign-in code". In selection mode the whole card is a checkbox.
 */
import { CheckIcon, KeyRoundIcon, RadioIcon } from 'lucide-react'
import { StatusPill } from '@/components/shell/StatusPill'
import { TvFrame } from '@/components/screens/TvFrame'
import { tvSubtitle } from '@/components/tvs/tv-copy'
import { Button } from '@/components/ui/button'
import { screenStatus } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { ScreenView } from '@/types/api'

export function TvCard({
  screen,
  onOpen,
  onShowCode,
  onHelpOffline,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  screen: ScreenView
  onOpen(): void
  onShowCode(): void
  onHelpOffline(): void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const status = screenStatus(screen)
  const subtitle = tvSubtitle(screen)
  const open = () => (selectable ? onToggleSelect?.() : onOpen())

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs transition-shadow',
        selectable && 'cursor-pointer',
        selectable && selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
      role={selectable ? 'checkbox' : undefined}
      aria-checked={selectable ? selected : undefined}
      aria-label={selectable ? `Select ${screen.name}` : undefined}
      onClick={selectable ? open : undefined}
      data-testid="tv-card"
    >
      <button
        type="button"
        onClick={(e) => {
          // In selection mode the whole card is the checkbox — don't toggle twice.
          if (selectable) e.stopPropagation()
          open()
        }}
        aria-label={selectable ? `Select ${screen.name}` : `Open ${screen.name}`}
        className="relative block w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <TvFrame
          thumbUrl={screen.current_item?.thumb_url ?? screen.preview_thumb_url}
          status={status}
          rotation={screen.rotation}
          orientation={screen.orientation}
          websiteUrl={screen.current_item?.website_url ?? screen.preview_website_url}
        >
          {screen.sync ? (
            <span className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[11px] font-medium text-white">
              <RadioIcon className="size-3" /> In sync
            </span>
          ) : null}
          {selectable ? (
            <span
              className={cn(
                'absolute top-2 left-2 z-10 flex size-7 items-center justify-center rounded-full border-2 border-white shadow-md',
                selected ? 'bg-primary text-white' : 'bg-black/40',
              )}
            >
              {selected ? <CheckIcon className="size-4" /> : null}
            </span>
          ) : null}
        </TvFrame>
      </button>

      <div className="flex items-center gap-2 px-1">
        <h2 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">{screen.name}</h2>
        <StatusPill status={status} size="md" />
      </div>
      <p className={cn('px-1 text-[15px]', status === 'offline' ? 'text-offline' : 'text-muted-foreground')}>
        {subtitle}
      </p>

      {selectable ? null : status === 'unpaired' ? (
        <Button size="xl" variant="outline" onClick={onShowCode}>
          <KeyRoundIcon /> Get the sign-in code
        </Button>
      ) : status === 'offline' ? (
        <div className="flex flex-col gap-2">
          <Button size="xl" variant="outline" className="border-2 border-primary text-primary" onClick={onHelpOffline}>
            How to fix this
          </Button>
          <button type="button" onClick={onOpen} className="text-center text-sm font-semibold text-primary hover:underline">
            Change what it shows anyway
          </button>
        </div>
      ) : (
        <Button size="xl" onClick={onOpen}>
          Change what&apos;s showing
        </Button>
      )}
    </div>
  )
}

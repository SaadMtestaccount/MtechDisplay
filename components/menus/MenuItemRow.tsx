'use client'

/**
 * components/menus/MenuItemRow.tsx — one line of the simple menu editor (docs/CONTRACTS.md §23):
 * number, thumb, name, "Show for [−] 10 s [+]" (photos and web pages; videos play to the end),
 * up / down / remove. No drag handle — the arrows are the only way to reorder.
 */
import { ChevronDownIcon, ChevronUpIcon, FilmIcon, ImageIcon, MinusIcon, PlusIcon, XIcon } from 'lucide-react'
import { WebsiteThumb } from '@/components/playlist/WebsiteThumb'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/utils'
import { DEFAULT_ITEM_DURATION_SECONDS, type PlaylistItemView } from '@/types/api'

const STEP = 5
const MIN = 3
const MAX = 600

export function MenuItemRow({
  item,
  index,
  count,
  onDuration,
  onMove,
  onRemove,
}: {
  item: PlaylistItemView
  index: number
  count: number
  onDuration(seconds: number): void
  onMove(direction: -1 | 1): void
  onRemove(): void
}) {
  const seconds = item.duration_seconds ?? DEFAULT_ITEM_DURATION_SECONDS
  const isVideo = item.media_type === 'video'
  const Fallback = isVideo ? FilmIcon : ImageIcon

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-2.5">
      <span className="w-7 text-center text-lg font-extrabold text-muted-foreground">{index + 1}</span>
      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.media_type === 'website' ? (
          <WebsiteThumb url={item.website_url} />
        ) : item.thumb_url ? (
          <img src={item.thumb_url} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Fallback className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 basis-32">
        <div className="truncate text-base font-semibold" title={item.name}>
          {item.name}
        </div>
        <div className="text-sm text-muted-foreground">
          {isVideo
            ? `Video · plays to the end${item.source_duration_seconds ? ` (${formatDuration(item.source_duration_seconds)})` : ''}`
            : item.media_type === 'website'
              ? 'Web page'
              : 'Photo'}
          {item.expired ? <span className="ml-2 font-semibold text-destructive">Expired — not shown</span> : null}
        </div>
      </div>

      {isVideo ? null : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Show for</span>
          <div className="flex items-center overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              aria-label="Show for less time"
              disabled={seconds <= MIN}
              onClick={() => onDuration(Math.max(MIN, seconds - STEP))}
              className="flex size-10 items-center justify-center bg-muted text-primary hover:bg-muted/70 disabled:opacity-40"
            >
              <MinusIcon className="size-4" />
            </button>
            <span className="w-14 text-center text-base font-bold text-foreground tabular-nums">{seconds} s</span>
            <button
              type="button"
              aria-label="Show for more time"
              disabled={seconds >= MAX}
              onClick={() => onDuration(Math.min(MAX, seconds + STEP))}
              className="flex size-10 items-center justify-center bg-muted text-primary hover:bg-muted/70 disabled:opacity-40"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="icon-lg" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <ChevronUpIcon />
        </Button>
        <Button variant="outline" size="icon-lg" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ChevronDownIcon />
        </Button>
        <Button variant="outline" size="icon-lg" aria-label={`Remove ${item.name}`} className="text-destructive" onClick={onRemove}>
          <XIcon />
        </Button>
      </div>
    </div>
  )
}

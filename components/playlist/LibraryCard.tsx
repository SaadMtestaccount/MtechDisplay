'use client'

import { useDraggable } from '@dnd-kit/core'
import { FilmIcon, ImageIcon, PlusIcon } from 'lucide-react'
import { WebsiteThumb } from '@/components/playlist/WebsiteThumb'
import { libraryDragId, type LibraryPick } from '@/components/playlist/playlist-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, formatDuration } from '@/lib/utils'

/**
 * Mini library card (docs/CONTRACTS.md §9.5): draggable into the playlist pane
 * (id `lib:{kind}:{id}`) with a + button to append. Expired content is listed but disabled —
 * not draggable, + disabled, tooltip explains why.
 */
export function LibraryCard({
  pick,
  onAdd,
  disabled = false,
}: {
  pick: LibraryPick
  onAdd(): void
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: libraryDragId(pick),
    data: { pick },
    disabled,
  })
  const name = pick.kind === 'content' ? pick.content.name : pick.website.name

  const card = (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex touch-none flex-col gap-1.5 rounded-lg bg-background p-1.5 ring-1 ring-foreground/10 transition-shadow select-none',
        disabled ? 'opacity-60' : 'cursor-grab hover:ring-primary/40 active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
        {pick.kind === 'website' ? (
          <WebsiteThumb url={pick.website.url} />
        ) : pick.content.thumb_url ? (
          <img
            src={pick.content.thumb_url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {pick.content.type === 'video' ? <FilmIcon className="size-5" /> : <ImageIcon className="size-5" />}
          </div>
        )}
        {pick.kind === 'content' && pick.content.type === 'video' && pick.content.duration_seconds !== null ? (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white tabular-nums">
            {formatDuration(pick.content.duration_seconds)}
          </span>
        ) : null}
        {pick.kind === 'content' && pick.content.expired ? (
          <Badge variant="destructive" className="absolute top-1 left-1 bg-destructive text-white">
            Expired
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-xs font-medium" title={name}>
          {name}
        </p>
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label={`Add ${name} to playlist`}
          disabled={disabled}
          onClick={onAdd}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  )

  if (!disabled) return card
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="min-w-0" />}>{card}</TooltipTrigger>
      <TooltipContent>Expired content is not shown on screens</TooltipContent>
    </Tooltip>
  )
}

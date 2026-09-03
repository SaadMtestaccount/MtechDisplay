'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FilmIcon, GripVerticalIcon, ImageIcon, XIcon } from 'lucide-react'
import { DurationInput } from '@/components/playlist/DurationInput'
import { SchedulePopover } from '@/components/playlist/SchedulePopover'
import { TransitionSelect } from '@/components/playlist/TransitionSelect'
import { WebsiteThumb } from '@/components/playlist/WebsiteThumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PlaylistItemInput } from '@/lib/validators/playlists'
import { DEFAULT_ITEM_DURATION_SECONDS, type ManifestSchedule, type PlaylistItemView } from '@/types/api'

const TYPE_LABELS = { image: 'Image', video: 'Video', website: 'Website' } as const

/**
 * One sortable playlist row (docs/CONTRACTS.md §9.5, id `row:{item_id}`): thumb, name,
 * Expired badge, duration override (videos show the detected duration as placeholder),
 * transition, mute (videos only), schedule popover, remove.
 */
export function PlaylistRow({
  item,
  onChange,
  onRemove,
}: {
  item: PlaylistItemView
  onChange(patch: Partial<PlaylistItemInput>): void
  onRemove(): void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `row:${item.id}`,
  })

  const schedule: ManifestSchedule = {
    active_from: item.active_from,
    active_to: item.active_to,
    days_of_week: item.days_of_week,
    daily_start: item.daily_start,
    daily_end: item.daily_end,
  }
  const durationPlaceholder =
    item.media_type === 'video' && item.source_duration_seconds !== null
      ? Math.max(1, Math.ceil(item.source_duration_seconds))
      : DEFAULT_ITEM_DURATION_SECONDS

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg bg-card p-2 ring-1 ring-foreground/10',
        isDragging && 'relative z-10 opacity-60 ring-primary/50',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.name}`}
        className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="h-10 w-[71px] shrink-0 overflow-hidden rounded-md bg-muted">
        {item.media_type === 'website' ? (
          <WebsiteThumb url={item.website_url} />
        ) : item.thumb_url ? (
          <img src={item.thumb_url} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {item.media_type === 'video' ? <FilmIcon className="size-4" /> : <ImageIcon className="size-4" />}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 basis-36">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="min-w-0 truncate text-sm font-medium" title={item.name}>
            {item.name}
          </p>
          {item.expired ? (
            <Tooltip>
              <TooltipTrigger render={<Badge variant="destructive" className="shrink-0" />}>
                Expired
              </TooltipTrigger>
              <TooltipContent>Expired content is not shown on screens</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{TYPE_LABELS[item.media_type]}</p>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-2">
        <DurationInput
          value={item.duration_seconds}
          placeholder={durationPlaceholder}
          onChange={(v) => onChange({ duration_seconds: v })}
        />
        <TransitionSelect value={item.transition} onChange={(v) => onChange({ transition: v })} />
        {item.media_type === 'video' ? (
          <div className="flex shrink-0 items-center gap-1.5" title="Play this video muted">
            <span className="text-xs text-muted-foreground">Mute</span>
            <Switch
              size="sm"
              checked={item.mute}
              onCheckedChange={(checked) => onChange({ mute: checked })}
              aria-label="Mute video"
            />
          </div>
        ) : null}
        <SchedulePopover value={schedule} onChange={(v) => onChange({ ...v })} />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${item.name} from playlist`}
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}

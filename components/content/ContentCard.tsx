'use client'

import {
  CalendarClockIcon, DownloadIcon, EyeIcon, FilmIcon, FolderIcon, FolderInputIcon, ImageIcon,
  PencilIcon, Trash2Icon,
} from 'lucide-react'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useApp } from '@/hooks/useApp'
import { dateInZone } from '@/lib/schedule'
import { formatBytes, formatDuration } from '@/lib/utils'
import type { ContentView } from '@/types/api'

/** The card kebab's actions — imported by ContentGrid / ContentLibrary (docs/CONTRACTS.md §9.2). */
export type ContentCardAction = 'rename' | 'move' | 'expiration' | 'preview' | 'download' | 'delete'

/**
 * Library card: 16:9 thumbnail, name, size, video duration badge, red Expired badge (else an
 * "Expires {date in org zone}" caption — §5.11 rule) and the folder caption when the item sits
 * in a folder (root search shows results from the whole org). Clicking the card previews.
 */
export function ContentCard({ item, onAction }: { item: ContentView; onAction(action: ContentCardAction): void }) {
  const { org } = useApp()
  const timezone = org?.timezone ?? 'UTC'
  const FallbackIcon = item.type === 'video' ? FilmIcon : ImageIcon

  return (
    <Card
      size="sm"
      className="cursor-pointer gap-3 transition-shadow hover:ring-foreground/20"
      onClick={() => onAction('preview')}
    >
      <div className="px-3">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted/40">
          {item.thumb_url ? (
            <img src={item.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <FallbackIcon className="size-8 text-muted-foreground" />
            </div>
          )}
          {item.expired ? (
            <Badge variant="destructive" className="absolute top-2 left-2 bg-destructive text-white">
              Expired
            </Badge>
          ) : null}
          {item.type === 'video' && item.duration_seconds !== null ? (
            <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
              {formatDuration(item.duration_seconds)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 px-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold" title={item.name}>
            {item.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatBytes(item.size_bytes)}
            {item.folder_name ? (
              <span className="inline-flex items-center gap-1 before:mx-1.5 before:content-['·']">
                <FolderIcon className="size-3" />
                {item.folder_name}
              </span>
            ) : null}
          </p>
          {!item.expired && item.expires_at !== null ? (
            <p className="text-xs text-warning">Expires {dateInZone(item.expires_at, timezone)}</p>
          ) : null}
        </div>
        <KebabMenu
          label={`Actions for ${item.name}`}
          items={[
            { label: 'Rename', icon: <PencilIcon />, onSelect: () => onAction('rename') },
            { label: 'Move to folder', icon: <FolderInputIcon />, onSelect: () => onAction('move') },
            { label: 'Set expiration', icon: <CalendarClockIcon />, onSelect: () => onAction('expiration') },
            { label: 'Preview', icon: <EyeIcon />, onSelect: () => onAction('preview') },
            { label: 'Download', icon: <DownloadIcon />, onSelect: () => onAction('download') },
            {
              label: 'Delete',
              icon: <Trash2Icon />,
              onSelect: () => onAction('delete'),
              destructive: true,
              separatorBefore: true,
            },
          ]}
        />
      </div>
    </Card>
  )
}

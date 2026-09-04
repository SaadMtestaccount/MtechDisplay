'use client'

import {
  FolderInputIcon,
  FolderMinusIcon,
  LayersIcon,
  ListVideoIcon,
  MegaphoneIcon,
  PencilIcon,
  RefreshCwIcon,
  RotateCwIcon,
  Trash2Icon,
} from 'lucide-react'
import { KebabMenu, type KebabItem } from '@/components/shell/KebabMenu'
import { TvFrame } from '@/components/screens/TvFrame'
import { screenStatus } from '@/lib/status'
import { relativeTime } from '@/lib/utils'
import type { ScreenView } from '@/types/api'

export type ScreenCardAction =
  | 'open'
  | 'rename'
  | 'rotation'
  | 'identify'
  | 'reload'
  | 'group'
  | 'ungroup'
  | 'delete'

/** One screen: TV mockup + name + last-seen line + kebab. The whole card opens the playlist. */
export function ScreenCard({
  screen,
  now,
  onAction,
}: {
  screen: ScreenView
  now: Date
  onAction(action: ScreenCardAction): void
}) {
  const status = screenStatus(screen)
  const unpaired = status === 'unpaired'

  const items: KebabItem[] = [
    { label: 'Open playlist', icon: <ListVideoIcon />, onSelect: () => onAction('open') },
    { label: 'Rename', icon: <PencilIcon />, onSelect: () => onAction('rename') },
    { label: 'Rotation', icon: <RotateCwIcon />, onSelect: () => onAction('rotation') },
    { label: 'Identify', icon: <MegaphoneIcon />, onSelect: () => onAction('identify'), disabled: unpaired },
    { label: 'Reload player', icon: <RefreshCwIcon />, onSelect: () => onAction('reload'), disabled: unpaired },
    { label: 'Move to group', icon: <FolderInputIcon />, onSelect: () => onAction('group') },
  ]
  if (screen.group_id !== null) {
    items.push({ label: 'Remove from group', icon: <FolderMinusIcon />, onSelect: () => onAction('ungroup') })
  }
  items.push({
    label: 'Delete screen',
    icon: <Trash2Icon />,
    onSelect: () => onAction('delete'),
    destructive: true,
    separatorBefore: true,
  })

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAction('open')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onAction('open')
      }}
      aria-label={`Open ${screen.name}`}
      className="group flex cursor-pointer flex-col gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <TvFrame
        thumbUrl={screen.current_item?.thumb_url ?? screen.preview_thumb_url}
        status={status}
        rotation={screen.rotation}
        websiteUrl={screen.current_item?.website_url ?? screen.preview_website_url}
      />
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{screen.name}</div>
          {screen.group_name ? (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <LayersIcon className="size-3 shrink-0" />
              <span className="truncate">{screen.group_name}</span>
            </div>
          ) : null}
          <div className="mt-0.5 text-xs text-muted-foreground">
            {unpaired ? 'Never paired' : `Last seen ${relativeTime(screen.last_seen_at, now)}`}
          </div>
        </div>
        <KebabMenu items={items} label={`Actions for ${screen.name}`} />
      </div>
    </div>
  )
}

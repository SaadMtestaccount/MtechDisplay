'use client'

/**
 * components/wall/WallTile.tsx — one TV on the Screen Wall: a droppable TvFrame (live thumbnail +
 * status) that opens the TV full screen in a new tab when clicked, plus a lock overlay and a
 * kebab (code, full screen, settings, lock, clear, delete). A locked tile is not a drop target.
 */
import { useDroppable } from '@dnd-kit/core'
import { KeyRoundIcon, LockIcon, MaximizeIcon, MoveIcon, SettingsIcon, Trash2Icon } from 'lucide-react'
import { KebabMenu, type KebabItem } from '@/components/shell/KebabMenu'
import { TvFrame } from '@/components/screens/TvFrame'
import { tileDropId } from '@/components/wall/wall-dnd'
import { screenStatus } from '@/lib/status'
import { cn, formatLoginCode } from '@/lib/utils'
import type { ScreenView } from '@/types/api'

export function WallTile({
  screen,
  onOpen,
  onShowCode,
  onToggleLock,
  onClear,
  onDelete,
  onPositionWatermark,
}: {
  screen: ScreenView
  onOpen(): void
  onShowCode(): void
  onToggleLock(): void
  onClear(): void
  onDelete(): void
  /** MTech staff only: opens the "Powered by MTech" positioning preview (§18). */
  onPositionWatermark?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tileDropId(screen.id), disabled: screen.locked })
  const status = screenStatus(screen)
  const configured = screen.preview_thumb_url !== null || screen.preview_website_url !== null
  const hasContent = screen.menu_name !== null || screen.current_item !== null || configured
  const showing =
    status === 'unpaired'
      ? `Not signed in · code ${formatLoginCode(screen.login_code)}`
      : screen.menu_name
        ? `Menu · ${screen.menu_name}`
        : (screen.current_item?.name ?? (configured ? 'Ready to play' : 'Nothing assigned'))

  // Clicking the TV = watch it: /player?code=… enrolls the new tab as this screen (§14/§17).
  const openFullScreen = () => {
    if (!screen.login_code) {
      onOpen()
      return
    }
    window.open(`/player?code=${screen.login_code}`, '_blank', 'noopener')
  }

  const menuItems: KebabItem[] = [
    { label: 'Show code', icon: <KeyRoundIcon />, onSelect: onShowCode },
    { label: 'Open full screen', icon: <MaximizeIcon />, onSelect: openFullScreen },
    { label: 'Open settings', icon: <SettingsIcon />, onSelect: onOpen },
    ...(onPositionWatermark
      ? [{ label: 'Position watermark', icon: <MoveIcon />, onSelect: onPositionWatermark }]
      : []),
    screen.locked
      ? { label: 'Unlock', icon: <LockIcon />, onSelect: onToggleLock, separatorBefore: true }
      : { label: 'Lock', icon: <LockIcon />, onSelect: onToggleLock, disabled: !hasContent, separatorBefore: true },
    { label: 'Clear', disabled: screen.locked, onSelect: onClear },
    { label: 'Delete screen', icon: <Trash2Icon />, destructive: true, separatorBefore: true, onSelect: onDelete },
  ]

  return (
    <div ref={setNodeRef} className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={openFullScreen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openFullScreen()
          }
        }}
        title="Open full screen in a new tab"
        aria-label={`Open ${screen.name} full screen`}
        className={cn(
          'cursor-pointer overflow-hidden rounded-lg outline-none transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring',
          isOver && !screen.locked && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <TvFrame
          thumbUrl={screen.current_item?.thumb_url ?? screen.preview_thumb_url}
          status={status}
          rotation={screen.rotation}
          orientation={screen.orientation}
          websiteUrl={screen.current_item?.website_url ?? screen.preview_website_url}
        >
          {screen.locked ? (
            <div className="absolute inset-0 flex items-end justify-start bg-black/25 p-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                <LockIcon className="size-3" /> Locked
              </span>
            </div>
          ) : null}
          {isOver && !screen.locked ? <div className="absolute inset-0 bg-primary/15" /> : null}
        </TvFrame>
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{screen.name}</div>
          <div className="truncate text-xs text-muted-foreground">{showing}</div>
        </div>
        <KebabMenu label={`Actions for ${screen.name}`} items={menuItems} />
      </div>
    </div>
  )
}

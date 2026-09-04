'use client'

/** components/menus/MenuCard.tsx — one menu in the library: cover, name, board/screen counts, kebab. */
import { LayoutGridIcon } from 'lucide-react'
import { KebabMenu } from '@/components/shell/KebabMenu'
import type { MenuView } from '@/types/api'

export function MenuCard({
  menu,
  onOpen,
  onRename,
  onDelete,
}: {
  menu: MenuView
  onOpen(): void
  onRename(): void
  onDelete(): void
}) {
  const boards = `${menu.item_count} board${menu.item_count === 1 ? '' : 's'}`
  const screens =
    menu.screen_count > 0 ? ` · on ${menu.screen_count} screen${menu.screen_count === 1 ? '' : 's'}` : ''

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video bg-muted">
        {menu.thumb_url ? (
          <img src={menu.thumb_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <LayoutGridIcon className="size-8" />
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{menu.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {boards}
            {screens}
          </div>
        </div>
        <KebabMenu
          label={`Actions for ${menu.name}`}
          items={[
            { label: 'Edit boards', onSelect: onOpen },
            { label: 'Rename', onSelect: onRename },
            { label: 'Delete', destructive: true, separatorBefore: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  )
}

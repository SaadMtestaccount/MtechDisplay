'use client'

/** components/menus/MenuCard.tsx — one menu in the library: big cover, name, counts, kebab (§23). */
import { ListIcon } from 'lucide-react'
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
  const things = `${menu.item_count} ${menu.item_count === 1 ? 'photo or video' : 'photos & videos'}`
  const screens =
    menu.screen_count > 0
      ? ` · on ${menu.screen_count} ${menu.screen_count === 1 ? 'TV' : 'TVs'}`
      : ' · not on a TV'

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
      className="surface pressable flex cursor-pointer flex-col gap-3 p-3.5 transition-[box-shadow] hover:shadow-float focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video overflow-hidden rounded-[14px] bg-muted ring-1 ring-black/[0.05]">
        {menu.thumb_url ? (
          <img src={menu.thumb_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ListIcon className="size-8" />
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 px-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold tracking-[-0.01em]">{menu.name}</div>
          <div className="truncate text-sm text-muted-foreground">
            {things}
            {screens}
          </div>
        </div>
        <KebabMenu
          label={`Actions for ${menu.name}`}
          items={[
            { label: 'Open', onSelect: onOpen },
            { label: 'Rename', onSelect: onRename },
            { label: 'Delete', destructive: true, separatorBefore: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  )
}

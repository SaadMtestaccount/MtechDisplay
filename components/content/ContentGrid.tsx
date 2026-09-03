'use client'

import { ContentCard, type ContentCardAction } from '@/components/content/ContentCard'
import { FolderCard } from '@/components/content/FolderCard'
import type { ContentView, FolderView } from '@/types/api'

const FOLDER_GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
const ITEM_GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

/** Folder cards first, then content cards (docs/CONTRACTS.md §9.2, spec §6). */
export function ContentGrid({
  folders,
  items,
  onOpenFolder,
  onFolderAction,
  onItemAction,
}: {
  folders: FolderView[]
  items: ContentView[]
  onOpenFolder(f: FolderView): void
  onFolderAction(action: 'rename' | 'delete', f: FolderView): void
  onItemAction(action: ContentCardAction, item: ContentView): void
}) {
  return (
    <div className="flex flex-col gap-6">
      {folders.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Folders</h2>
          <div className={FOLDER_GRID}>
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onOpen={() => onOpenFolder(folder)}
                onRename={() => onFolderAction('rename', folder)}
                onDelete={() => onFolderAction('delete', folder)}
              />
            ))}
          </div>
        </section>
      ) : null}
      {items.length > 0 ? (
        <section className="flex flex-col gap-2">
          {folders.length > 0 ? (
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Files</h2>
          ) : null}
          <div className={ITEM_GRID}>
            {items.map((item) => (
              <ContentCard key={item.id} item={item} onAction={(action) => onItemAction(action, item)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

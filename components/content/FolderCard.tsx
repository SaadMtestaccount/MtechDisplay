'use client'

import { FolderIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Card } from '@/components/ui/card'
import type { FolderView } from '@/types/api'

/** Root-view folder card: icon, name, item count, kebab (docs/CONTRACTS.md §9.2). */
export function FolderCard({
  folder,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: FolderView
  onOpen(): void
  onRename(): void
  onDelete(): void
}) {
  return (
    <Card
      size="sm"
      className="cursor-pointer flex-row items-center gap-3 px-3 transition-shadow hover:ring-foreground/20"
      onClick={onOpen}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FolderIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={folder.name}>
          {folder.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {folder.item_count} {folder.item_count === 1 ? 'item' : 'items'}
        </p>
      </div>
      <KebabMenu
        label={`Actions for ${folder.name}`}
        items={[
          { label: 'Rename', icon: <PencilIcon />, onSelect: onRename },
          { label: 'Delete', icon: <Trash2Icon />, onSelect: onDelete, destructive: true, separatorBefore: true },
        ]}
      />
    </Card>
  )
}

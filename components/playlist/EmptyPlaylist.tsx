import { ListVideoIcon } from 'lucide-react'

/** Empty state inside the droppable playlist pane (docs/CONTRACTS.md §9.5). */
export function EmptyPlaylist() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ListVideoIcon className="size-6" />
      </div>
      <p className="text-sm font-medium">No items in this playlist</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Drag content or websites in from the library, or click + on a card to add it. Changes save
        automatically.
      </p>
    </div>
  )
}

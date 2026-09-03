'use client'

import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The right pane's drop target (docs/CONTRACTS.md §9.5, droppable id `playlist-drop`).
 * A child of <DndContext> so useDroppable registers against the editor's context;
 * `highlight` is true while a LIBRARY card is being dragged (row sorts don't highlight).
 */
export function PlaylistDropPane({ highlight, children }: { highlight: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'playlist-drop' })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[280px] rounded-xl border border-dashed p-2 transition-colors',
        highlight && isOver ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      {children}
    </div>
  )
}

'use client'

import { ScreenCard, type ScreenCardAction } from '@/components/screens/ScreenCard'
import type { ScreenView } from '@/types/api'

/** Responsive grid of ScreenCards. `screens` are already realtime-merged by ScreensBoard. */
export function ScreenGrid({
  screens,
  now,
  onAction,
}: {
  screens: ScreenView[]
  now: Date
  onAction(action: ScreenCardAction, screen: ScreenView): void
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {screens.map((screen) => (
        <ScreenCard key={screen.id} screen={screen} now={now} onAction={(action) => onAction(action, screen)} />
      ))}
    </div>
  )
}

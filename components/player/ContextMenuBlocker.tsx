'use client'

/**
 * components/player/ContextMenuBlocker.tsx — cancels the browser context menu (right-click, or a
 * long-press on touch) while the player is fullscreen, so a kiosk can't be pulled out of playback
 * through the menu (docs/CONTRACTS.md §17). Outside fullscreen the menu works as normal.
 */
import { useEffect } from 'react'

export function ContextMenuBlocker() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (document.fullscreenElement) e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [])

  return null
}

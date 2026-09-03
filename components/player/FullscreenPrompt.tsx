'use client'

/**
 * components/player/FullscreenPrompt.tsx — requests fullscreen on a tap while the page
 * is not fullscreen (docs/CONTRACTS.md §9.7). Browsers only honor the request inside a
 * user gesture, so this is the whole "prompt"; kiosk-mode browsers are already
 * fullscreen and never trigger it. Failures are silent (no error UI on the TV).
 */
import { useEffect } from 'react'

export function FullscreenPrompt() {
  useEffect(() => {
    const onTap = () => {
      if (document.fullscreenElement) return
      const root = document.documentElement
      if (typeof root.requestFullscreen !== 'function') return
      void root.requestFullscreen().catch(() => {})
    }

    window.addEventListener('pointerdown', onTap)
    return () => window.removeEventListener('pointerdown', onTap)
  }, [])

  return null
}

'use client'

/**
 * components/player/CursorHider.tsx — hides the cursor after 3s idle (spec §12,
 * docs/CONTRACTS.md §9.7). Any pointer activity shows it again and restarts the timer.
 */
import { useEffect } from 'react'

const IDLE_MS = 3_000

export function CursorHider() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const hide = () => {
      document.documentElement.style.cursor = 'none'
    }
    const wake = () => {
      document.documentElement.style.cursor = ''
      if (timer) clearTimeout(timer)
      timer = setTimeout(hide, IDLE_MS)
    }

    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('pointerdown', wake)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('pointerdown', wake)
      document.documentElement.style.cursor = ''
    }
  }, [])

  return null
}

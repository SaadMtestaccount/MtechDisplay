'use client'

/**
 * components/player/ExitFullscreenHotspot.tsx — an invisible square pinned to the top-left of
 * the PHYSICAL screen (rendered outside RotationRoot, so it ignores orientation/rotation). Five
 * consecutive taps within TAP_WINDOW_MS toggle fullscreen — the way out on a touch screen with
 * no keyboard. Exiting also suppresses FullscreenPrompt's auto re-entry, otherwise the next tap
 * would put the player straight back; five more taps re-enter (docs/CONTRACTS.md §17).
 */
import { useRef, type PointerEvent } from 'react'
import { setAutoFullscreenSuppressed } from '@/lib/player/fullscreen'

const TAPS_TO_TOGGLE = 5
const TAP_WINDOW_MS = 3000

export function ExitFullscreenHotspot() {
  const taps = useRef<number[]>([])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now]
    if (taps.current.length < TAPS_TO_TOGGLE) return
    taps.current = []

    if (document.fullscreenElement) {
      setAutoFullscreenSuppressed(true)
      void document.exitFullscreen().catch(() => {})
      return
    }
    setAutoFullscreenSuppressed(false)
    const root = document.documentElement
    if (typeof root.requestFullscreen === 'function') void root.requestFullscreen().catch(() => {})
  }

  return (
    <div
      aria-hidden
      onPointerDown={onPointerDown}
      className="fixed top-0 left-0 z-50 size-16 select-none"
      style={{ touchAction: 'manipulation' }}
    />
  )
}

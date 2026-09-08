'use client'

/**
 * components/player/ExitFullscreenHotspot.tsx — five consecutive taps/clicks in the top-left
 * corner of the PHYSICAL screen exit fullscreen: the way out on a touch screen with no keyboard
 * (docs/CONTRACTS.md §17). Only active WHILE fullscreen — outside it nothing is counted or drawn,
 * and any partial count is dropped the moment fullscreen ends (Esc, browser UI, or this). Taps
 * are counted from a window-level capture listener by coordinates, so nothing layered over the
 * corner can hide them; the invisible square only keeps a web-page iframe from swallowing the
 * pointer events. Each registered tap shows a ripple where it landed plus a five-dot progress
 * row in the corner. Exiting blocks FullscreenPrompt's tap-to-enter for REENTER_DELAY_MS
 * (otherwise the next tap would undo it); after that a single tap re-enters as normal.
 * Rendered outside RotationRoot so orientation/rotation don't move it.
 */
import { useEffect, useRef, useState } from 'react'
import { suppressAutoFullscreenFor } from '@/lib/player/fullscreen'
import { cn } from '@/lib/utils'

const TAPS_TO_EXIT = 5
const TAP_WINDOW_MS = 5000
const REENTER_DELAY_MS = 5000
const ZONE_PX = 96
const RIPPLE_MS = 900

type Ripple = { id: number; x: number; y: number }

export function ExitFullscreenHotspot() {
  const taps = useRef<number[]>([])
  const nextId = useRef(0)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [count, setCount] = useState(0)
  const [lastTap, setLastTap] = useState(0)

  useEffect(() => {
    const reset = () => {
      taps.current = []
      setCount(0)
      setRipples([])
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!document.fullscreenElement) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.clientX > ZONE_PX || e.clientY > ZONE_PX) return
      const now = Date.now()
      const recent = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now]

      const id = nextId.current++
      setRipples((r) => [...r, { id, x: e.clientX, y: e.clientY }])
      setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), RIPPLE_MS)

      if (recent.length >= TAPS_TO_EXIT) {
        reset()
        suppressAutoFullscreenFor(REENTER_DELAY_MS)
        void document.exitFullscreen().catch(() => {})
        return
      }
      taps.current = recent
      setCount(recent.length)
      setLastTap(now)
    }

    // Leaving fullscreen by any route drops a partial count so no dots linger on the page.
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) reset()
    }

    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  // The progress row clears once the 5 s tap window lapses without reaching five.
  useEffect(() => {
    if (lastTap === 0) return
    const t = setTimeout(() => {
      taps.current = []
      setCount(0)
    }, TAP_WINDOW_MS)
    return () => clearTimeout(t)
  }, [lastTap])

  return (
    <>
      <div
        aria-hidden
        className="fixed top-0 left-0 z-[9999] select-none"
        style={{ width: ZONE_PX, height: ZONE_PX, touchAction: 'manipulation' }}
      />
      {count > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none fixed top-3 left-3 z-[9999] flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 ring-1 ring-white/40"
        >
          {Array.from({ length: TAPS_TO_EXIT }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2 border-white',
                i < count ? 'bg-white' : 'bg-transparent',
              )}
            />
          ))}
        </div>
      ) : null}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none fixed z-[9999] size-12 rounded-full border-4 border-white bg-white/60 shadow-[0_0_0_3px_rgba(0,0,0,0.5)] animate-[tap-dot_900ms_ease-out_forwards]"
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </>
  )
}

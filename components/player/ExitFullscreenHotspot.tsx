'use client'

/**
 * components/player/ExitFullscreenHotspot.tsx — five consecutive taps/clicks in the top-left
 * corner of the PHYSICAL screen toggle fullscreen: the way out on a touch screen with no
 * keyboard (docs/CONTRACTS.md §17). Taps are counted from a window-level capture listener by
 * coordinates, so nothing layered over the corner can hide them; the invisible square only
 * keeps a web-page iframe from swallowing the pointer events. Each registered tap shows a
 * translucent ripple where it landed plus a five-dot progress row in the corner. Exiting also
 * suppresses FullscreenPrompt's auto re-entry (otherwise the next tap would undo it); five
 * more taps re-enter. Rendered outside RotationRoot so orientation/rotation don't move it.
 */
import { useEffect, useRef, useState } from 'react'
import { setAutoFullscreenSuppressed } from '@/lib/player/fullscreen'
import { cn } from '@/lib/utils'

const TAPS_TO_TOGGLE = 5
const TAP_WINDOW_MS = 3000
const ZONE_PX = 96
const RIPPLE_MS = 700

type Ripple = { id: number; x: number; y: number }

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    setAutoFullscreenSuppressed(true)
    void document.exitFullscreen().catch(() => {})
    return
  }
  setAutoFullscreenSuppressed(false)
  const root = document.documentElement
  if (typeof root.requestFullscreen === 'function') void root.requestFullscreen().catch(() => {})
}

export function ExitFullscreenHotspot() {
  const taps = useRef<number[]>([])
  const nextId = useRef(0)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [count, setCount] = useState(0)
  const [lastTap, setLastTap] = useState(0)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.clientX > ZONE_PX || e.clientY > ZONE_PX) return
      const now = Date.now()
      const recent = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now]

      const id = nextId.current++
      setRipples((r) => [...r, { id, x: e.clientX, y: e.clientY }])
      setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), RIPPLE_MS)

      if (recent.length >= TAPS_TO_TOGGLE) {
        taps.current = []
        setCount(0)
        toggleFullscreen()
        return
      }
      taps.current = recent
      setCount(recent.length)
      setLastTap(now)
    }
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }, [])

  // The progress row clears once the tap window lapses without reaching five.
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
        <div aria-hidden className="pointer-events-none fixed top-3 left-3 z-[9999] flex gap-1.5">
          {Array.from({ length: TAPS_TO_TOGGLE }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'size-2 rounded-full border border-white/60',
                i < count ? 'bg-white/80' : 'bg-white/10',
              )}
            />
          ))}
        </div>
      ) : null}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none fixed z-[9999] size-7 rounded-full bg-white/40 ring-2 ring-white/60 animate-[tap-dot_700ms_ease-out_forwards]"
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </>
  )
}

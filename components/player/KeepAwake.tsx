'use client'

/**
 * components/player/KeepAwake.tsx — keeps the TV display awake (docs/CONTRACTS.md §9.7):
 * `navigator.wakeLock` when available (re-requested on visibilitychange), else a hidden
 * muted `<video>` whose srcObject is a canvas.captureStream(1) MediaStream (a 2×2 canvas
 * repainted once per second). Every failure in either path is silent — keep-awake must
 * never break playback.
 */
import { useEffect, useRef, useState } from 'react'

export function KeepAwake() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [useFallback, setUseFallback] = useState(false)

  // Primary: Screen Wake Lock API.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let disposed = false

    const request = async () => {
      try {
        if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
          setUseFallback(true)
          return
        }
        const sentinel = await navigator.wakeLock.request('screen')
        if (disposed) {
          void sentinel.release().catch(() => {})
          return
        }
        lock = sentinel
      } catch {
        setUseFallback(true)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (lock) void lock.release().catch(() => {})
    }
  }, [])

  // Fallback: a live canvas-driven MediaStream keeps the "playing video" heuristic alive.
  useEffect(() => {
    if (!useFallback) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 2
      canvas.height = 2
      const ctx = canvas.getContext('2d')
      if (!ctx || typeof canvas.captureStream !== 'function') return

      let shade = 0
      const paint = () => {
        try {
          ctx.fillStyle = shade % 2 === 0 ? '#000000' : '#010101'
          ctx.fillRect(0, 0, 2, 2)
          shade += 1
        } catch {
          // silent
        }
      }
      paint()

      const stream = canvas.captureStream(1)
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        void video.play().catch(() => {})
      }
      const timer = setInterval(paint, 1_000)
      return () => {
        clearInterval(timer)
        try {
          for (const track of stream.getTracks()) track.stop()
        } catch {
          // silent
        }
        if (video) video.srcObject = null
      }
    } catch {
      return
    }
  }, [useFallback])

  if (!useFallback) return null

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      loop
      aria-hidden
      tabIndex={-1}
      style={{ position: 'fixed', bottom: 0, right: 0, width: 2, height: 2, opacity: 0, pointerEvents: 'none' }}
    />
  )
}

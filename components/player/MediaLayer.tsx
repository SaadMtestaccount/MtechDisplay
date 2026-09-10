'use client'

/**
 * components/player/MediaLayer.tsx — renders one image or video manifest item
 * (docs/CONTRACTS.md §9.7). Videos autoplay with `muted` per the item flag; when an unmuted
 * autoplay is blocked the layer falls back to muted playback instead of stalling the loop (the
 * engine's safety timer would advance past it anyway). Near the end of a video it asks the
 * engine to start the next item early so the crossfade covers the finish, and hides itself the
 * instant `ended` fires — TV browsers paint their own grey "paused" overlay on a finished video
 * otherwise (§21). `loop` keeps a lone video seamless. In synced playback (`syncStartMs`) the
 * video seeks to the slot offset and re-aligns whenever it drifts more than SYNC_TOLERANCE_S.
 */
import { useEffect, useRef } from 'react'
import { syncedNow } from '@/lib/player/clock'
import type { ManifestItem } from '@/types/api'

const NEAR_END_S = 0.35
const SYNC_TOLERANCE_S = 0.5
const DRIFT_CHECK_MS = 3_000

export function MediaLayer({
  item,
  src,
  active,
  loop = false,
  syncStartMs = null,
  onEnded,
  onNearEnd,
  onError,
}: {
  item: ManifestItem | null
  src: string | null
  active: boolean
  loop?: boolean
  syncStartMs?: number | null
  onEnded(): void
  onNearEnd(): void
  onError(): void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const nearEndFired = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !active || item?.type !== 'video' || !video.paused) return
    void video.play().catch(() => {
      if (!video.muted) {
        video.muted = true
        void video.play().catch(() => {
          // still blocked — the duration+1s safety timer advances past it
        })
      }
    })
  }, [active, item, src])

  // Synced playback: land on the slot offset once the duration is known, then correct drift.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !active || item?.type !== 'video' || syncStartMs === null) return
    const align = () => {
      const duration = video.duration
      let target = (syncedNow() - syncStartMs) / 1000
      if (!Number.isFinite(duration) || duration <= 0) return
      if (loop) target = target % duration
      if (target >= duration - NEAR_END_S) return
      if (Math.abs(video.currentTime - target) > SYNC_TOLERANCE_S) {
        try {
          video.currentTime = target
        } catch {
          // not seekable yet — the next check retries
        }
      }
    }
    if (video.readyState >= 1) align()
    else video.addEventListener('loadedmetadata', align, { once: true })
    const timer = setInterval(align, DRIFT_CHECK_MS)
    return () => {
      clearInterval(timer)
      video.removeEventListener('loadedmetadata', align)
    }
  }, [active, item, src, syncStartMs, loop])

  if (!item || !src) return null

  if (item.type === 'image') {
    return <img src={src} alt="" draggable={false} className="pl-media" onError={onError} />
  }

  return (
    <video
      ref={videoRef}
      src={src}
      muted={item.mute}
      loop={loop}
      playsInline
      autoPlay
      preload="auto"
      disableRemotePlayback
      className="pl-media"
      onTimeUpdate={(e) => {
        const video = e.currentTarget
        if (loop || nearEndFired.current || !Number.isFinite(video.duration)) return
        if (video.duration - video.currentTime <= NEAR_END_S) {
          nearEndFired.current = true
          onNearEnd()
        }
      }}
      onEnded={(e) => {
        e.currentTarget.style.visibility = 'hidden'
        onEnded()
      }}
      onError={onError}
    />
  )
}

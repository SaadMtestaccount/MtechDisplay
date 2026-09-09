'use client'

/**
 * components/player/MediaLayer.tsx — renders one image or video manifest item
 * (docs/CONTRACTS.md §9.7). Videos autoplay with `muted` per the item flag; when an
 * unmuted autoplay is blocked the layer falls back to muted playback instead of
 * stalling the loop (the engine's safety timer would advance past it anyway).
 */
import { useEffect, useRef } from 'react'
import type { ManifestItem } from '@/types/api'

export function MediaLayer({
  item,
  src,
  active,
  onEnded,
  onError,
}: {
  item: ManifestItem | null
  src: string | null
  active: boolean
  onEnded(): void
  onError(): void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

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

  if (!item || !src) return null

  if (item.type === 'image') {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className="pl-media"
        onError={onError}
      />
    )
  }

  return (
    <video
      ref={videoRef}
      src={src}
      muted={item.mute}
      playsInline
      autoPlay
      preload="auto"
      className="pl-media"
      onEnded={onEnded}
      onError={onError}
    />
  )
}

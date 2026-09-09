'use client'

/**
 * components/player/PlaybackEngine.tsx — the playback loop (docs/CONTRACTS.md §10).
 * Active items = schedule (screen timezone) + expiry filter, re-evaluated on every
 * advance and every 30s. Two stacked layers give the 300ms fade crossfade with the next
 * item pre-mounted ('none' swaps instantly); images/websites advance after
 * duration_seconds, videos on `ended` with a duration+1s safety timer; media errors skip
 * the item; websites are skipped while offline; standby when nothing is playable.
 * A manifest swap keeps the position by item id.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { useMediaCache } from '@/hooks/useMediaCache'
import { advanceDelayMs, isItemExpired, nextPlayable } from '@/lib/player/playback'
import { isItemActive } from '@/lib/schedule'
import type { Manifest, ManifestItem } from '@/types/api'
import { MediaLayer } from '@/components/player/MediaLayer'
import { StandbyScreen } from '@/components/player/StandbyScreen'
import { WebsiteLayer } from '@/components/player/WebsiteLayer'

const FADE_MS = 300
const PREMOUNT_MS = 60
const REEVALUATE_MS = 30_000
const ERROR_RETRY_MS = 30_000

type Layer = { item: ManifestItem | null; src: string | null; nonce: number }
const EMPTY_LAYER: Layer = { item: null, src: null, nonce: 0 }

function stopTimer(ref: MutableRefObject<ReturnType<typeof setTimeout> | null>): void {
  if (ref.current) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

export function PlaybackEngine({
  manifest,
  cache,
  offline,
  timeZone,
  onCurrentItem,
}: {
  manifest: Manifest
  cache: ReturnType<typeof useMediaCache>
  offline: boolean
  timeZone: string
  onCurrentItem(itemId: string | null): void
}) {
  const [layers, setLayers] = useState<[Layer, Layer]>([EMPTY_LAYER, EMPTY_LAYER])
  const [activeIdx, setActiveIdx] = useState<0 | 1>(0)
  const [fade, setFade] = useState(true)
  const [standby, setStandby] = useState(true)

  const manifestRef = useRef(manifest)
  const timeZoneRef = useRef(timeZone)
  timeZoneRef.current = timeZone
  const cacheRef = useRef(cache)
  cacheRef.current = cache
  const offlineRef = useRef(offline)
  offlineRef.current = offline
  const onCurrentItemRef = useRef(onCurrentItem)
  onCurrentItemRef.current = onCurrentItem

  const currentRef = useRef<ManifestItem | null>(null)
  const activeIdxRef = useRef<0 | 1>(0)
  const nonceRef = useRef(0)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const erroredRef = useRef(new Map<string, number>())
  const advanceRef = useRef<() => void>(() => {})

  const isActiveNow = useCallback((item: ManifestItem, now: Date): boolean => {
    return isItemActive(item.schedule, now, timeZoneRef.current) && !isItemExpired(item, now)
  }, [])

  const canPlay = useCallback((item: ManifestItem): boolean => {
    const erroredAt = erroredRef.current.get(item.id)
    if (erroredAt !== undefined && Date.now() - erroredAt < ERROR_RETRY_MS) return false
    if (item.type === 'website') return !offlineRef.current
    return cacheRef.current.srcFor(item) !== null
  }, [])

  const setLayer = useCallback((idx: 0 | 1, layer: Layer) => {
    setLayers((prev) => (idx === 0 ? [layer, prev[1]] : [prev[0], layer]))
  }, [])

  const armAdvance = useCallback((item: ManifestItem) => {
    stopTimer(advanceTimerRef)
    advanceTimerRef.current = setTimeout(() => advanceRef.current(), advanceDelayMs(item))
  }, [])

  const goStandby = useCallback(() => {
    stopTimer(advanceTimerRef)
    stopTimer(swapTimerRef)
    stopTimer(clearTimerRef)
    currentRef.current = null
    onCurrentItemRef.current(null)
    setLayers([EMPTY_LAYER, EMPTY_LAYER])
    setStandby(true)
  }, [])

  /** Mounts `next` in the inactive layer, then crossfades (300ms) or swaps instantly. */
  const show = useCallback(
    (next: ManifestItem) => {
      stopTimer(swapTimerRef)
      stopTimer(clearTimerRef)
      const incoming: 0 | 1 = activeIdxRef.current === 0 ? 1 : 0
      nonceRef.current += 1
      currentRef.current = next
      setStandby(false)
      onCurrentItemRef.current(next.id)
      setLayer(incoming, { item: next, src: cacheRef.current.srcFor(next), nonce: nonceRef.current })
      const useFade = next.transition === 'fade'
      setFade(useFade)
      const activate = () => {
        activeIdxRef.current = incoming
        setActiveIdx(incoming)
        clearTimerRef.current = setTimeout(
          () => setLayer(incoming === 0 ? 1 : 0, EMPTY_LAYER),
          useFade ? FADE_MS + 100 : 50,
        )
      }
      if (useFade) swapTimerRef.current = setTimeout(activate, PREMOUNT_MS)
      else activate()
      armAdvance(next)
    },
    [armAdvance, setLayer],
  )

  /** Re-evaluates the active list and moves to the next playable item (or standby). */
  const advance = useCallback(() => {
    stopTimer(advanceTimerRef)
    const now = new Date()
    const list = manifestRef.current.items.filter((item) => isActiveNow(item, now))
    const current = currentRef.current
    const next = nextPlayable(list, current?.id ?? null, canPlay)
    if (!next) {
      goStandby()
      return
    }
    if (current && next.id === current.id) {
      // The only playable item repeats: videos remount (restart), images just re-arm.
      currentRef.current = next
      const idx = activeIdxRef.current
      if (next.type === 'video') {
        nonceRef.current += 1
        setLayer(idx, { item: next, src: cacheRef.current.srcFor(next), nonce: nonceRef.current })
      } else {
        setLayers((prev) => {
          const existing = prev[idx]
          if (!existing.item) return prev
          const updated: Layer = { ...existing, item: next }
          return idx === 0 ? [updated, prev[1]] : [prev[0], updated]
        })
      }
      armAdvance(next)
      return
    }
    show(next)
  }, [isActiveNow, canPlay, goStandby, show, armAdvance, setLayer])
  advanceRef.current = advance

  /** Interrupts only when the current item became invalid (or we are in standby). */
  const reconsider = useCallback(() => {
    const current = currentRef.current
    if (!current) {
      advanceRef.current()
      return
    }
    const stillListed = manifestRef.current.items.some((item) => item.id === current.id)
    if (!stillListed || !isActiveNow(current, new Date()) || !canPlay(current)) advanceRef.current()
  }, [isActiveNow, canPlay])

  // Manifest swap: keep playing the same item id when it is still active and playable.
  useEffect(() => {
    manifestRef.current = manifest
    const current = currentRef.current
    if (!current) {
      advanceRef.current()
      return
    }
    const replacement = manifest.items.find((item) => item.id === current.id)
    if (replacement && isActiveNow(replacement, new Date()) && canPlay(replacement)) {
      currentRef.current = replacement
      const idx = activeIdxRef.current
      setLayers((prev) => {
        const existing = prev[idx]
        if (!existing.item) return prev
        const updated: Layer = { ...existing, item: replacement } // keep src — no restart
        return idx === 0 ? [updated, prev[1]] : [prev[0], updated]
      })
      armAdvance(replacement)
    } else {
      advanceRef.current()
    }
  }, [manifest, isActiveNow, canPlay, armAdvance])

  // Schedule boundaries and expirations: re-evaluate every 30s.
  useEffect(() => {
    const timer = setInterval(() => reconsider(), REEVALUATE_MS)
    return () => clearInterval(timer)
  }, [reconsider])

  // Offline flips: websites become skippable / playable again immediately.
  useEffect(() => {
    reconsider()
  }, [offline, reconsider])

  // Cache progress: leave standby as soon as something becomes playable.
  useEffect(() => {
    if (currentRef.current === null) reconsider()
  }, [cache, reconsider])

  useEffect(
    () => () => {
      stopTimer(advanceTimerRef)
      stopTimer(swapTimerRef)
      stopTimer(clearTimerRef)
    },
    [],
  )

  const handleEnded = useCallback((item: ManifestItem) => {
    if (currentRef.current?.id === item.id) advanceRef.current()
  }, [])

  const handleError = useCallback((item: ManifestItem) => {
    console.warn('[player] media error — skipping', item.name)
    erroredRef.current.set(item.id, Date.now())
    if (currentRef.current?.id === item.id) advanceRef.current()
  }, [])

  return (
    <div className="pl-fill pl-clip pl-black">
      {standby ? (
        <StandbyScreen
          orgName={manifest.org.name}
          logoUrl={manifest.org.logo_url}
          noContent={manifest.items.length === 0}
        />
      ) : null}
      {layers.map((layer, idx) => {
        const item = layer.item
        const isActive = idx === activeIdx && !standby
        return (
          <div
            key={idx}
            className="pl-fill"
            style={{
              opacity: isActive ? 1 : 0,
              transition: fade ? `opacity ${FADE_MS}ms ease-in-out` : 'none',
              zIndex: isActive ? 2 : 1,
            }}
          >
            {item === null ? null : item.type === 'website' ? (
              <WebsiteLayer key={`${item.id}:${layer.nonce}`} item={item} active={isActive} />
            ) : (
              <MediaLayer
                key={`${item.id}:${layer.nonce}`}
                item={item}
                src={layer.src}
                active={isActive}
                onEnded={() => handleEnded(item)}
                onError={() => handleError(item)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

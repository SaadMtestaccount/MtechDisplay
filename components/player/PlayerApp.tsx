'use client'

/**
 * components/player/PlayerApp.tsx — the player state machine (docs/CONTRACTS.md §10):
 * boot → unpaired (pairing-code loop) | paired (manifest + heartbeat + channel + engine).
 * offline = heartbeat.failing || manifest.status === 'offline' (decision §0.15). A 401
 * from any device call — or an `unpair` hint verified by a 401 from fetchManifest —
 * wipes msign.device/manifest/pending and the media cache and returns to pairing;
 * msign.fingerprint is created once and never wiped.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { useMediaCache } from '@/hooks/useMediaCache'
import { usePlayerChannel } from '@/hooks/usePlayerChannel'
import { usePlayerDevice } from '@/hooks/usePlayerDevice'
import { usePlayerManifest } from '@/hooks/usePlayerManifest'
import { usePlayerPairing } from '@/hooks/usePlayerPairing'
import { DeviceApiError, fetchManifest } from '@/lib/player/device-api'
import { deleteMediaCache } from '@/lib/player/media-cache'
import { FINGERPRINT_KEY, MANIFEST_KEY, PENDING_KEY, newId, readJson, remove, writeJson } from '@/lib/player/player-storage'
import type { HeartbeatRequest } from '@/types/api'
import { CursorHider } from '@/components/player/CursorHider'
import { FullscreenPrompt } from '@/components/player/FullscreenPrompt'
import { IdentifyOverlay } from '@/components/player/IdentifyOverlay'
import { KeepAwake } from '@/components/player/KeepAwake'
import { PairingScreen } from '@/components/player/PairingScreen'
import { PlaybackEngine } from '@/components/player/PlaybackEngine'
import { PlayerErrorBoundary } from '@/components/player/PlayerErrorBoundary'
import { RotationRoot } from '@/components/player/RotationRoot'

const IDENTIFY_MS = 10_000

export function PlayerApp() {
  const { device, hydrated, save, clear } = usePlayerDevice()
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [identifyVisible, setIdentifyVisible] = useState(false)

  const deviceRef = useRef(device)
  deviceRef.current = device
  const currentItemRef = useRef<string | null>(null)
  const identifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unpairCheckRef = useRef(false)

  // Fingerprint: created once, reused forever (msign.fingerprint, §10).
  useEffect(() => {
    const existing = readJson<string>(FINGERPRINT_KEY)
    if (typeof existing === 'string' && existing.length >= 8) {
      setFingerprint(existing)
      return
    }
    const created = newId()
    writeJson(FINGERPRINT_KEY, created)
    setFingerprint(created)
  }, [])

  /** 401 anywhere (manifest, heartbeat, verified unpair) → wipe → pairing screen. */
  const wipe = useCallback(() => {
    clear()
    remove(MANIFEST_KEY)
    remove(PENDING_KEY)
    currentItemRef.current = null
    void deleteMediaCache()
  }, [clear])

  const manifestState = usePlayerManifest({
    deviceToken: device?.device_token ?? null,
    onUnauthorized: wipe,
  })
  const { manifest, refetch } = manifestState
  const manifestRef = useRef(manifest)
  manifestRef.current = manifest

  const getState = useCallback(
    (): HeartbeatRequest => ({
      current_item_id: currentItemRef.current,
      resolution: `${window.screen.width}x${window.screen.height}`,
      playlist_version: manifestRef.current?.playlist_version ?? -1,
      uptime_seconds: Math.max(0, Math.round(performance.now() / 1000)),
    }),
    [],
  )

  const heartbeat = useHeartbeat({
    enabled: hydrated && device !== null,
    deviceToken: device?.device_token ?? null,
    getState,
    onVersionMismatch: () => void refetch(),
    onUnauthorized: wipe,
  })

  const offline = heartbeat.failing || manifestState.status === 'offline'

  // Heartbeat recovery (failing true → false): refetch once — the outage may have hidden a sync.
  const prevFailingRef = useRef(false)
  useEffect(() => {
    if (prevFailingRef.current && !heartbeat.failing) void refetch()
    prevFailingRef.current = heartbeat.failing
  }, [heartbeat.failing, refetch])

  const cache = useMediaCache(manifest, offline)

  const showIdentify = useCallback(() => {
    setIdentifyVisible(true)
    if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current)
    identifyTimerRef.current = setTimeout(() => setIdentifyVisible(false), IDENTIFY_MS)
  }, [])
  useEffect(
    () => () => {
      if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current)
    },
    [],
  )

  /** `unpair` is a hint (decision §0.2): wipe only after the API answers 401. */
  const verifyUnpair = useCallback(async () => {
    const token = deviceRef.current?.device_token
    if (!token || unpairCheckRef.current) return
    unpairCheckRef.current = true
    try {
      await fetchManifest(token)
      console.warn('[player] ignoring unpair: manifest still authorized')
    } catch (e) {
      if (e instanceof DeviceApiError && e.status === 401) wipe()
      else console.warn('[player] unpair verification failed — keeping state', e)
    } finally {
      unpairCheckRef.current = false
    }
  }, [wipe])

  usePlayerChannel({
    screenId: device?.screen_id ?? null,
    onSync: () => void refetch(),
    onReload: () => window.location.reload(),
    onIdentify: showIdentify,
    onUnpair: () => void verifyUnpair(),
    onReconnect: () => void refetch(),
  })

  const pairing = usePlayerPairing({
    enabled: hydrated && device === null && fingerprint !== null,
    fingerprint,
    onPaired: save,
  })

  const handleCurrentItem = useCallback((itemId: string | null) => {
    currentItemRef.current = itemId
  }, [])

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

  return (
    <PlayerErrorBoundary>
      <RotationRoot rotation={manifest?.screen.rotation ?? 0}>
        {!hydrated ? null : device === null ? (
          <PairingScreen code={pairing.code} expiresAt={pairing.expiresAt} appUrl={appUrl} error={pairing.error} />
        ) : manifest !== null ? (
          <>
            <PlaybackEngine
              manifest={manifest}
              cache={cache}
              offline={offline}
              timeZone={manifest.screen.timezone}
              onCurrentItem={handleCurrentItem}
            />
            <IdentifyOverlay name={manifest.screen.name} visible={identifyVisible} />
          </>
        ) : null}
      </RotationRoot>
      <CursorHider />
      <FullscreenPrompt />
      <KeepAwake />
    </PlayerErrorBoundary>
  )
}

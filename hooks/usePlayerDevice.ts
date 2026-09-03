'use client'

/**
 * hooks/usePlayerDevice.ts — the paired-device credential in localStorage `msign.device`
 * (docs/CONTRACTS.md §8/§10). `hydrated` flips true after the first client read so the
 * boot state renders nothing until we know whether the device is paired.
 */
import { useCallback, useEffect, useState } from 'react'
import { DEVICE_KEY, readJson, remove, writeJson } from '@/lib/player/player-storage'
import type { PlayerDeviceState } from '@/types/api'

function isDeviceState(v: unknown): v is PlayerDeviceState {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).device_token === 'string' &&
    typeof (v as Record<string, unknown>).screen_id === 'string'
  )
}

export function usePlayerDevice(): {
  device: PlayerDeviceState | null
  hydrated: boolean
  save(state: PlayerDeviceState): void
  clear(): void
} {
  const [device, setDevice] = useState<PlayerDeviceState | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readJson<PlayerDeviceState>(DEVICE_KEY)
    if (isDeviceState(stored)) {
      setDevice(stored)
    } else if (stored !== null) {
      remove(DEVICE_KEY)
    }
    setHydrated(true)
  }, [])

  const save = useCallback((state: PlayerDeviceState) => {
    writeJson(DEVICE_KEY, state)
    setDevice(state)
  }, [])

  const clear = useCallback(() => {
    remove(DEVICE_KEY)
    setDevice(null)
  }, [])

  return { device, hydrated, save, clear }
}

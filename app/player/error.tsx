'use client'

/**
 * app/player/error.tsx — route-level error boundary for /player, backing up
 * PlayerErrorBoundary for errors thrown above it: black screen, auto-reload after 10s
 * (no error UI on the TV, spec §12).
 */
import { useEffect } from 'react'

const RELOAD_AFTER_MS = 10_000

export default function PlayerError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[player] route error — reloading in 10s', error)
    const timer = setTimeout(() => window.location.reload(), RELOAD_AFTER_MS)
    return () => clearTimeout(timer)
  }, [error])

  return <div className="fixed inset-0 bg-black" />
}

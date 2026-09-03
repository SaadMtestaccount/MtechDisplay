'use client'

/**
 * components/player/WebsiteLayer.tsx — sandboxed iframe for website items
 * (docs/CONTRACTS.md §9.7). While active, the iframe is remounted (fresh load) every
 * `refresh_seconds`; 0 = never. Cleanup clears the timer.
 */
import { useEffect, useState } from 'react'
import type { ManifestItem } from '@/types/api'

export function WebsiteLayer({ item, active }: { item: ManifestItem | null; active: boolean }) {
  const [reloadNonce, setReloadNonce] = useState(0)
  const itemId = item?.id ?? null
  const refreshSeconds = item?.refresh_seconds ?? 0

  useEffect(() => {
    if (!itemId || !active || refreshSeconds <= 0) return
    const timer = setInterval(() => setReloadNonce((n) => n + 1), refreshSeconds * 1000)
    return () => clearInterval(timer)
  }, [itemId, active, refreshSeconds])

  if (!item) return null

  return (
    <iframe
      key={reloadNonce}
      src={item.url}
      title={item.name}
      sandbox="allow-scripts allow-same-origin"
      className="h-full w-full border-0 bg-white"
    />
  )
}

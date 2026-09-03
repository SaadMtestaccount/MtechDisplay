'use client'

import { PlayIcon } from 'lucide-react'
import { faviconUrl } from '@/lib/utils'
import type { CurrentItemView } from '@/types/api'

const CHIP = 'inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs'

/**
 * Live "Now playing" chip on the screen detail page. The caller passes the merged view's
 * current_item (docs/CONTRACTS.md §9.4); website items render their favicon.
 */
export function NowPlayingChip({ item, online }: { item: CurrentItemView | null; online: boolean }) {
  if (!online) {
    return (
      <span className={`${CHIP} text-muted-foreground`}>
        <span className="size-1.5 shrink-0 rounded-full bg-offline" />
        Offline
      </span>
    )
  }
  if (!item) {
    return (
      <span className={`${CHIP} text-muted-foreground`}>
        <PlayIcon className="size-3.5 shrink-0" />
        Nothing playing
      </span>
    )
  }

  const icon = item.media_type === 'website' && item.website_url ? faviconUrl(item.website_url) : item.thumb_url

  return (
    <span className={`${CHIP} bg-card`}>
      {icon ? (
        <img src={icon} alt="" className="size-4 shrink-0 rounded-sm object-cover" />
      ) : (
        <PlayIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="shrink-0 text-muted-foreground">Now playing:</span>
      <span className="truncate font-medium">{item.name}</span>
    </span>
  )
}

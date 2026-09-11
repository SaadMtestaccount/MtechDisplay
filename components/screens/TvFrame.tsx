import { GlobeIcon, MonitorIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { StatusPill } from '@/components/shell/StatusPill'
import { faviconUrl } from '@/lib/utils'
import type { ScreenPresence } from '@/types/api'

/**
 * 16:9 TV mockup: current thumbnail (gradient fallback), StatusPill on the frame. Website
 * current items have no thumb — render a browser-frame placeholder with the site favicon
 * (docs/CONTRACTS.md §9.4). A portrait screen previews as an upright 9:16 stage centered on
 * the frame, matching what the player draws (§15).
 */
export function TvFrame({
  thumbUrl,
  status,
  rotation = 0,
  orientation = 'landscape',
  websiteUrl = null,
  children,
}: {
  thumbUrl: string | null
  status: ScreenPresence
  rotation?: number
  orientation?: string
  websiteUrl?: string | null
  children?: ReactNode
}) {
  const turned = rotation === 90 || rotation === 270
  const mediaStyle: CSSProperties | undefined =
    rotation !== 0 ? { transform: `rotate(${rotation}deg)${turned ? ' scale(0.5625)' : ''}` } : undefined
  const favicon = websiteUrl ? faviconUrl(websiteUrl) : ''
  const stageClass =
    orientation === 'portrait'
      ? 'absolute inset-y-0 left-1/2 aspect-[9/16] -translate-x-1/2 overflow-hidden'
      : 'absolute inset-0'

  return (
    <div className="rounded-[18px] bg-gradient-to-b from-zinc-700 via-zinc-900 to-zinc-950 p-[7px] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.55)] ring-1 ring-black/60">
      <div className="relative aspect-video overflow-hidden rounded-[11px] bg-black after:pointer-events-none after:absolute after:inset-0 after:z-[5] after:rounded-[11px] after:bg-gradient-to-b after:from-white/[0.07] after:to-transparent after:to-40%">
        <div className={stageClass}>
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="absolute inset-0 size-full object-cover" style={mediaStyle} />
          ) : websiteUrl ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
              <div className="w-3/5 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-lg">
                <div className="flex items-center gap-1 border-b border-zinc-700 bg-zinc-800 px-2 py-1.5">
                  <span className="size-1.5 rounded-full bg-zinc-600" />
                  <span className="size-1.5 rounded-full bg-zinc-600" />
                  <span className="size-1.5 rounded-full bg-zinc-600" />
                </div>
                <div className="flex items-center justify-center py-4">
                  {favicon ? (
                    <img src={favicon} alt="" className="size-6" />
                  ) : (
                    <GlobeIcon className="size-6 text-zinc-500" />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-zinc-900 to-zinc-950">
              <MonitorIcon className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-white/15" />
            </div>
          )}
        </div>
        <StatusPill status={status} className="absolute top-1.5 right-1.5 z-10" />
        {children}
      </div>
    </div>
  )
}

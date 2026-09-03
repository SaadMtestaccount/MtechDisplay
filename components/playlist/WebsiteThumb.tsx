import { GlobeIcon } from 'lucide-react'
import { cn, faviconUrl } from '@/lib/utils'

/**
 * Browser-frame placeholder for website items (websites have no thumb — PlaylistItemView /
 * CurrentItemView carry `thumb_url: null`); shows the site favicon when the URL parses.
 * Fills its parent (parent sets the aspect/size).
 */
export function WebsiteThumb({ url, className }: { url: string | null; className?: string }) {
  const favicon = url ? faviconUrl(url) : ''
  return (
    <div className={cn('flex size-full flex-col overflow-hidden bg-muted', className)}>
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border/60 bg-background/60 px-1 py-[3px]">
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span className="size-1 rounded-full bg-muted-foreground/40" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        {favicon ? (
          <img src={favicon} alt="" loading="lazy" className="size-5" draggable={false} />
        ) : (
          <GlobeIcon className="size-4 text-muted-foreground" />
        )}
      </div>
    </div>
  )
}

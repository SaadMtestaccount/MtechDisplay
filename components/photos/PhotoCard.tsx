'use client'

/** components/photos/PhotoCard.tsx — one photo/video in the merchant library with "Use on a TV" (§23). */
import { EyeIcon, FilmIcon, ImageIcon, PencilIcon, Trash2Icon, TvIcon } from 'lucide-react'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/utils'
import type { ContentView } from '@/types/api'

export type PhotoCardAction = 'use' | 'preview' | 'rename' | 'delete'

export function PhotoCard({ item, onAction }: { item: ContentView; onAction(action: PhotoCardAction): void }) {
  const Fallback = item.type === 'video' ? FilmIcon : ImageIcon
  const meta = item.type === 'video' ? `Video${item.duration_seconds ? ` · ${formatDuration(item.duration_seconds)}` : ''}` : 'Photo'

  return (
    <div className="surface flex flex-col gap-2.5 p-2.5">
      <button
        type="button"
        onClick={() => onAction('preview')}
        aria-label={`Preview ${item.name}`}
        className="pressable relative aspect-video w-full overflow-hidden rounded-[14px] bg-muted ring-1 ring-black/[0.05] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {item.thumb_url ? (
          <img src={item.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Fallback className="size-8" />
          </div>
        )}
        {item.type === 'video' ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 5v14l12-7z" />
              </svg>
            </span>
          </span>
        ) : null}
        {item.expired ? (
          <span className="absolute top-2 left-2 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-white">Expired</span>
        ) : null}
      </button>
      <div className="flex items-start gap-1 px-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold" title={item.name}>
            {item.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">{meta}</div>
        </div>
        <KebabMenu
          label={`Actions for ${item.name}`}
          items={[
            { label: 'Preview', icon: <EyeIcon />, onSelect: () => onAction('preview') },
            { label: 'Rename', icon: <PencilIcon />, onSelect: () => onAction('rename') },
            { label: 'Delete', icon: <Trash2Icon />, destructive: true, separatorBefore: true, onSelect: () => onAction('delete') },
          ]}
        />
      </div>
      <Button variant="outline" size="lg" className="border-2" disabled={item.expired} onClick={() => onAction('use')}>
        <TvIcon /> Use on a TV
      </Button>
    </div>
  )
}

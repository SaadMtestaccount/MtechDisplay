/**
 * components/player/Watermark.tsx — the "Powered by MTech" badge shown on every playing screen
 * (docs/CONTRACTS.md §18). `position` is the badge CENTRE as fractions of the stage (set by MTech
 * staff in WatermarkPositionDialog); null = the default bottom-right corner. Sizes use container
 * units (cqmin) against the stage — RotationRoot and the admin preview both declare
 * `container-type: size` — so the same component is WYSIWYG in the preview and on the TV.
 */
import type { CSSProperties, Ref } from 'react'
import { cn } from '@/lib/utils'
import type { WatermarkPosition } from '@/types/api'

export function watermarkStyle(position: WatermarkPosition | null): CSSProperties {
  return position
    ? { left: `${position.x * 100}%`, top: `${position.y * 100}%`, transform: 'translate(-50%, -50%)' }
    : { right: '2.5cqmin', bottom: '2.5cqmin' }
}

export function WatermarkBadge({
  style,
  className,
  ref,
}: {
  style?: CSSProperties
  className?: string
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-20 whitespace-nowrap rounded-full bg-black/60 px-[1.8cqmin] py-[0.9cqmin] text-[1.9cqmin] leading-none font-semibold text-white shadow-md ring-1 ring-white/25 backdrop-blur-sm',
        className,
      )}
      style={style}
    >
      Powered by <span className="text-[#c7c5ff]">MTech</span>
    </div>
  )
}

export function Watermark({ position }: { position: WatermarkPosition | null }) {
  return <WatermarkBadge style={watermarkStyle(position)} />
}

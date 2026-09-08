/**
 * components/player/Watermark.tsx — the "Powered by MTech" badge shown on every playing screen
 * (docs/CONTRACTS.md §18). `position` is the badge CENTRE as fractions of the stage (set by MTech
 * staff in WatermarkPositionDialog); null = the default bottom-right corner. Size and corner
 * offsets come from the `.mtech-badge` rules in globals.css: container units (cqmin) against the
 * stage — RotationRoot and the admin preview both declare `container-type: size` — with a
 * viewport-unit fallback for Android WebViews that predate them. So the same component is
 * WYSIWYG in the preview and on the TV.
 */
import type { CSSProperties, Ref } from 'react'
import { cn } from '@/lib/utils'
import type { WatermarkPosition } from '@/types/api'

/** Positioned badge: centre at the fractions. Corner badge: offsets come from CSS (`data-corner`). */
export function watermarkStyle(position: WatermarkPosition | null): CSSProperties {
  return position
    ? { left: `${position.x * 100}%`, top: `${position.y * 100}%`, transform: 'translate(-50%, -50%)' }
    : {}
}

export function WatermarkBadge({
  position,
  className,
  ref,
}: {
  position: WatermarkPosition | null
  className?: string
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      aria-hidden
      data-corner={position ? undefined : ''}
      className={cn(
        'mtech-badge pointer-events-none absolute z-20 whitespace-nowrap rounded-full bg-black/60 leading-none font-semibold text-white shadow-md ring-1 ring-white/25 backdrop-blur-sm',
        className,
      )}
      style={watermarkStyle(position)}
    >
      Powered by <span className="text-[#c7c5ff]">MTech</span>
    </div>
  )
}

export function Watermark({ position }: { position: WatermarkPosition | null }) {
  return <WatermarkBadge position={position} />
}

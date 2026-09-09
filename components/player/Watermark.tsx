/**
 * components/player/Watermark.tsx — the "Powered by MTech" badge shown on every playing screen
 * (docs/CONTRACTS.md §18). `position` is the badge CENTRE as fractions of the stage (set by MTech
 * staff in WatermarkPositionDialog); null = the default bottom-right corner. Size and corner
 * offsets come from `.mtech-badge` in app/player.css: viewport units by default, container units
 * (cqmin, against a container-type:size stage) where the engine supports them (§20). The admin
 * preview reuses the component with `interactive` (draggable styling).
 */
import type { CSSProperties, Ref } from 'react'
import type { WatermarkPosition } from '@/types/api'

/** Positioned badge: centre at the fractions. Corner badge: offsets come from CSS (`data-corner`). */
export function watermarkStyle(position: WatermarkPosition | null): CSSProperties {
  return position
    ? { left: `${position.x * 100}%`, top: `${position.y * 100}%`, transform: 'translate(-50%, -50%)' }
    : {}
}

export function WatermarkBadge({
  position,
  interactive = false,
  ref,
}: {
  position: WatermarkPosition | null
  interactive?: boolean
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      aria-hidden
      data-corner={position ? undefined : ''}
      className={interactive ? 'mtech-badge mtech-badge--live' : 'mtech-badge'}
      style={watermarkStyle(position)}
    >
      Powered by <b>MTech</b>
    </div>
  )
}

export function Watermark({ position }: { position: WatermarkPosition | null }) {
  return <WatermarkBadge position={position} />
}

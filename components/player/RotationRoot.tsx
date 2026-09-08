'use client'

/**
 * components/player/RotationRoot.tsx — applies the screen rotation with a CSS transform,
 * swapping width/height for 90/270 so the rotated surface still fills the viewport
 * (docs/CONTRACTS.md §9.7). In portrait orientation the children render inside an upright
 * 9:16 stage contain-fitted and centered on that surface (§15) — so a tall menu shows
 * vertically in a landscape browser window, and fills a display that is already portrait.
 * Children lay out with `absolute inset-0` against the stage.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { Orientation, Rotation } from '@/types/api'

export function RotationRoot({
  rotation,
  orientation = 'landscape',
  children,
}: {
  rotation: Rotation
  orientation?: Orientation
  children: ReactNode
}) {
  const swapped = rotation === 90 || rotation === 270
  // `containerType: 'size'` lets stage-relative units (cqmin — the Watermark badge) size against
  // whichever box the children fill: the surface, or the portrait stage below.
  const surface: CSSProperties = swapped
    ? {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '100vh',
        height: '100vw',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        containerType: 'size',
      }
    : {
        position: 'absolute',
        inset: 0,
        transform: rotation === 180 ? 'rotate(180deg)' : undefined,
        containerType: 'size',
      }

  // The surface is 100vw×100vh (or 100vh×100vw when swapped), so a contain-fit 9:16 stage is a
  // pure CSS min() — no measuring needed.
  const stage: CSSProperties | null =
    orientation === 'portrait'
      ? swapped
        ? {
            width: 'min(100vh, calc(100vw * 9 / 16))',
            height: 'min(100vw, calc(100vh * 16 / 9))',
            containerType: 'size',
          }
        : {
            width: 'min(100vw, calc(100vh * 9 / 16))',
            height: 'min(100vh, calc(100vw * 16 / 9))',
            containerType: 'size',
          }
      : null

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div className="relative overflow-hidden bg-black" style={surface}>
        {stage ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative overflow-hidden bg-black" style={stage}>
              {children}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

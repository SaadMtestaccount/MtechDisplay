'use client'

/**
 * components/player/RotationRoot.tsx — applies the screen rotation with a CSS transform,
 * swapping width/height for 90/270 so the rotated surface still fills the viewport
 * (docs/CONTRACTS.md §9.7). In portrait orientation the children render inside an upright
 * 9:16 stage contain-fitted and centered on that surface (§15) — so a tall menu shows
 * vertically in a landscape browser window, and fills a display that is already portrait.
 * Sizes are measured from the viewport in JS rather than CSS min() so old TV browsers work
 * (§20). Children lay out with the `.pl-fill` class against the stage.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Orientation, Rotation } from '@/types/api'

type Viewport = { w: number; h: number }

export function RotationRoot({
  rotation,
  orientation = 'landscape',
  children,
}: {
  rotation: Rotation
  orientation?: Orientation
  children: ReactNode
}) {
  const [vp, setVp] = useState<Viewport | null>(null)
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const swapped = rotation === 90 || rotation === 270
  // `containerType: 'size'` lets stage-relative units (cqmin — the Watermark badge) size against
  // whichever box the children fill; engines without it simply ignore the property.
  const surface: CSSProperties = swapped
    ? {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: vp ? `${vp.h}px` : '100vh',
        height: vp ? `${vp.w}px` : '100vw',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        containerType: 'size',
      }
    : {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        transform: rotation === 180 ? 'rotate(180deg)' : undefined,
        containerType: 'size',
      }

  // Portrait: contain-fit a 9:16 stage inside the surface (whose size is the viewport, or the
  // viewport swapped for 90/270). Until the first measurement the children fill the surface.
  let stage: CSSProperties | null = null
  if (orientation === 'portrait' && vp) {
    const surfW = swapped ? vp.h : vp.w
    const surfH = swapped ? vp.w : vp.h
    const height = Math.min(surfH, (surfW * 16) / 9)
    const width = Math.min(surfW, (surfH * 9) / 16)
    stage = { width: `${Math.round(width)}px`, height: `${Math.round(height)}px`, containerType: 'size' }
  }

  return (
    <div className="pl-fill pl-clip pl-black">
      <div className="pl-surface" style={surface}>
        {stage ? (
          <div className="pl-fill pl-center">
            <div className="pl-stage" style={stage}>
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

'use client'

/**
 * components/player/RotationRoot.tsx — applies the screen rotation with a CSS transform,
 * swapping width/height for 90/270 so the rotated surface still fills the viewport
 * (docs/CONTRACTS.md §9.7). Children lay out with `absolute inset-0` against this root.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { Rotation } from '@/types/api'

export function RotationRoot({ rotation, children }: { rotation: Rotation; children: ReactNode }) {
  const swapped = rotation === 90 || rotation === 270
  const style: CSSProperties = swapped
    ? {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '100vh',
        height: '100vw',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }
    : {
        position: 'absolute',
        inset: 0,
        transform: rotation === 180 ? 'rotate(180deg)' : undefined,
      }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div className="relative overflow-hidden bg-black" style={style}>
        {children}
      </div>
    </div>
  )
}

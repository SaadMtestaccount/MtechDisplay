'use client'

/**
 * components/player/IdentifyOverlay.tsx — overlays the screen name for 10s when the
 * admin sends `identify` (docs/CONTRACTS.md §7, §9.7). The 10s timer lives in PlayerApp.
 * Styled by app/player.css (§20).
 */
export function IdentifyOverlay({ name, visible }: { name: string; visible: boolean }) {
  if (!visible) return null

  return (
    <div className="pl-identify">
      <div className="pl-identify-card">
        <div className="pl-identify-label">This screen is</div>
        <div className="pl-identify-name">{name}</div>
      </div>
    </div>
  )
}

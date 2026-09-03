'use client'

/**
 * components/player/IdentifyOverlay.tsx — overlays the screen name for 10s when the
 * admin sends `identify` (docs/CONTRACTS.md §7, §9.7). The 10s timer lives in PlayerApp.
 */
export function IdentifyOverlay({ name, visible }: { name: string; visible: boolean }) {
  if (!visible) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="rounded-2xl border-4 border-primary bg-black/80 px-16 py-10 text-center">
        <div className="text-xl uppercase tracking-widest text-white/60">This screen is</div>
        <div className="mt-3 text-7xl font-semibold leading-[1.05] tracking-[-0.02em] text-white">{name}</div>
      </div>
    </div>
  )
}

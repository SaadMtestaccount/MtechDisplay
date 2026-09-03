'use client'

/**
 * components/player/StandbyScreen.tsx — org logo (or name) + clock, shown when the
 * active list is empty or nothing is playable (docs/CONTRACTS.md §9.7, §10).
 */
import { useNow } from '@/hooks/useNow'

export function StandbyScreen({ orgName, logoUrl }: { orgName: string; logoUrl: string | null }) {
  const now = useNow(1000)
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 bg-black text-white">
      {logoUrl ? (
        <img src={logoUrl} alt={orgName} className="max-h-40 max-w-[60%] object-contain" />
      ) : (
        <div className="text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-white/80">{orgName}</div>
      )}
      <div className="text-center">
        <div className="text-8xl font-semibold leading-[1.05] tracking-[-0.02em] tabular-nums">{time}</div>
        <div className="mt-3 text-2xl text-white/50">{date}</div>
      </div>
    </div>
  )
}

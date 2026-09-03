'use client'

/**
 * components/player/StandbyScreen.tsx — org logo (or name) + clock, shown when the
 * active list is empty or nothing is playable (docs/CONTRACTS.md §9.7, §10).
 * `noContent` (manifest has zero items) adds the contact-MTech line (addendum §13).
 */
import { useNow } from '@/hooks/useNow'

export function StandbyScreen({
  orgName,
  logoUrl,
  noContent = false,
}: {
  orgName: string
  logoUrl: string | null
  noContent?: boolean
}) {
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
      {noContent ? (
        <div className="max-w-3xl px-10 text-center text-2xl leading-relaxed text-white/70">
          Please contact MTech with photos and videos of the digital menu.
        </div>
      ) : null}
    </div>
  )
}

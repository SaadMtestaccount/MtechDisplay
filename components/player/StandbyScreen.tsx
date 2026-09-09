'use client'

/**
 * components/player/StandbyScreen.tsx — org logo (or name) + clock, shown when the
 * active list is empty or nothing is playable (docs/CONTRACTS.md §9.7, §10).
 * `noContent` (manifest has zero items) adds the contact-MTech line (addendum §13).
 * Styled by app/player.css (§20).
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
    <div className="pl-standby">
      {logoUrl ? (
        <img src={logoUrl} alt={orgName} className="pl-standby-logo" />
      ) : (
        <div className="pl-standby-name">{orgName}</div>
      )}
      <div>
        <div className="pl-clock">{time}</div>
        <div className="pl-date">{date}</div>
      </div>
      {noContent ? <div className="pl-note">Please contact MTech with photos and videos of the digital menu.</div> : null}
    </div>
  )
}

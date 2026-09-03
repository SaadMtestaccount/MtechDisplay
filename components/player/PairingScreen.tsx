'use client'

/**
 * components/player/PairingScreen.tsx — the unpaired state: MSIGN wordmark (slice A's
 * /msign.svg — no org logo before pairing, decision §0.3), the pairing code huge, and
 * where to enter it. The countdown is informational; codes refresh automatically (§10).
 */
import { useNow } from '@/hooks/useNow'

export function PairingScreen({
  code,
  expiresAt,
  appUrl,
  error,
}: {
  code: string | null
  expiresAt: string | null
  appUrl: string
  error?: string | null
}) {
  const now = useNow(1000)
  const remainingMs = expiresAt ? Date.parse(expiresAt) - now.getTime() : NaN
  const minutesLeft = Number.isFinite(remainingMs) && remainingMs > 0 ? Math.ceil(remainingMs / 60_000) : null

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 bg-black px-10 text-center text-white">
      <img src="/msign.svg" alt="MSIGN" className="h-12 w-auto" />
      {code ? (
        <div className="font-semibold leading-none tracking-[0.18em] tabular-nums text-[clamp(4rem,16vw,11rem)]">
          {code}
        </div>
      ) : (
        <div className="text-3xl text-white/50">Requesting a pairing code…</div>
      )}
      <div className="max-w-3xl text-2xl leading-relaxed text-white/70">
        Enter this code at <span className="font-semibold text-white">{appUrl}</span> → Screens → Add Screen
      </div>
      {minutesLeft !== null ? (
        <div className="text-lg text-white/40">
          Code refreshes automatically · expires in about {minutesLeft} min
        </div>
      ) : null}
      {error ? <div className="text-lg text-warning">{error}</div> : null}
    </div>
  )
}

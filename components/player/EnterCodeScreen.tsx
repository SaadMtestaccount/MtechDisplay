'use client'

/**
 * components/player/EnterCodeScreen.tsx — the unpaired TV state (docs/CONTRACTS.md §15).
 * The store operator opens their MSIGN dashboard, adds/opens a TV, and types its login code here.
 */
import { useState, type FormEvent } from 'react'
import { enroll } from '@/lib/player/device-api'
import type { PlayerDeviceState } from '@/types/api'

export function EnterCodeScreen({
  fingerprint,
  appUrl,
  onEnrolled,
}: {
  fingerprint: string | null
  appUrl: string
  onEnrolled(state: PlayerDeviceState): void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !code.trim()) return
    if (!fingerprint) {
      setError('This TV is still starting up — try again in a moment.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      onEnrolled(await enroll(code.trim(), fingerprint))
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.")
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 bg-black px-10 text-center text-white">
      <img src="/msign.svg" alt="MSIGN" className="h-12 w-auto" />
      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl font-semibold leading-tight">Enter this TV&apos;s code</div>
        <div className="max-w-2xl text-2xl leading-relaxed text-white/60">
          On your MSIGN dashboard, open <span className="font-semibold text-white/80">TVs</span>, pick this TV,
          and type its code below.
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col items-center gap-5">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoFocus
          disabled={busy}
          autoComplete="off"
          autoCapitalize="characters"
          aria-label="TV code"
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-8 py-6 text-center text-6xl font-semibold uppercase tracking-[0.2em] text-white placeholder:text-white/25 outline-none focus:border-white/60"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="w-full rounded-2xl bg-primary px-6 py-5 text-3xl font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error ? <div className="text-xl text-warning">{error}</div> : null}
      <div className="text-lg text-white/25">{appUrl}</div>
    </div>
  )
}

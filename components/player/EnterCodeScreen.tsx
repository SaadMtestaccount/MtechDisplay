'use client'

/**
 * components/player/EnterCodeScreen.tsx — the unpaired TV state (docs/CONTRACTS.md §15).
 * The store operator opens their MSIGN dashboard, adds/opens a TV, and types its login code here.
 * Styled by app/player.css (§20).
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
    <div className="pl-code">
      <img src="/msign.svg" alt="MSIGN" className="pl-code-logo" />
      <div>
        <div className="pl-code-title">Enter this TV&apos;s code</div>
        <div className="pl-code-help">
          On your MSIGN dashboard, open <strong>TVs</strong>, pick this TV, and type its code below.
        </div>
      </div>
      <form onSubmit={handleSubmit} className="pl-code-form">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoFocus
          disabled={busy}
          autoComplete="off"
          autoCapitalize="characters"
          aria-label="TV code"
          className="pl-code-input"
        />
        <button type="submit" disabled={busy || !code.trim()} className="pl-code-btn">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error ? <div className="pl-error">{error}</div> : null}
      <div className="pl-url">{appUrl}</div>
    </div>
  )
}

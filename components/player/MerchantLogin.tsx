'use client'

/**
 * components/player/MerchantLogin.tsx — merchant sign-in on the TV (CONTRACTS addendum §13).
 * Email + password → supabase session → POST /api/device/self-claim → hand the device state
 * up and sign the session out (the device token is the auth from here on). If a session
 * already exists (merchant bounced from the admin shell), offer one-tap "Continue as".
 */
import { useEffect, useState } from 'react'
import { selfClaim } from '@/lib/player/device-api'
import { createBrowserClient } from '@/lib/supabase/client'
import type { PlayerDeviceState } from '@/types/api'

const inputClass =
  'w-full rounded-xl border border-white/20 bg-white/10 px-6 py-4 text-2xl text-white placeholder:text-white/30 outline-none focus:border-white/50'

export function MerchantLogin({
  fingerprint,
  onClaimed,
  onBack,
}: {
  fingerprint: string | null
  onClaimed(state: PlayerDeviceState): void
  onBack(): void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [existingEmail, setExistingEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled && data.user?.email) setExistingEmail(data.user.email)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const claim = async () => {
    if (!fingerprint) {
      setError('Device is not ready yet — try again in a moment.')
      return
    }
    const state = await selfClaim(fingerprint)
    await createBrowserClient()
      .auth.signOut()
      .catch(() => undefined)
    onClaimed(state)
  }

  const handleContinue = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await claim()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set up this screen')
      setBusy(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      const { error: authError } = await createBrowserClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        setError('Wrong email or password. Please check the credentials MTech gave you.')
        setBusy(false)
        return
      }
      await claim()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up this screen')
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <div className="text-3xl font-semibold">Merchant sign-in</div>
      <div className="text-xl text-white/60">Use the email and password MTech provided.</div>
      {existingEmail ? (
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={busy}
          className="w-full rounded-xl bg-primary px-6 py-4 text-2xl font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Setting up…' : `Continue as ${existingEmail}`}
        </button>
      ) : null}
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
          disabled={busy}
          className={inputClass}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          disabled={busy}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="rounded-xl bg-primary px-6 py-4 text-2xl font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error ? <div className="text-lg text-warning">{error}</div> : null}
      <button type="button" onClick={onBack} disabled={busy} className="text-lg text-white/40 underline-offset-4 hover:underline">
        Back to pairing code
      </button>
    </div>
  )
}

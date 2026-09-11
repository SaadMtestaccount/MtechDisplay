'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserClient } from '@/lib/supabase/client'
import { SUPPORT_EMAIL } from '@/lib/support'

/** `next` must be a same-site path: starts with '/' and not '//' (docs/CONTRACTS.md §9.1). */
function safeNext(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/'
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invalidLink = searchParams.get('error') === 'invalid_link'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const supabase = createBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      toast.error(signInError.message)
      setPending(false)
      return
    }
    router.replace(safeNext(searchParams.get('next')))
    // Bust the client router cache so server layouts re-render with the new session.
    router.refresh()
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      {/* Brand glow behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(60rem_24rem_at_50%_-6rem,rgba(91,87,232,0.22),transparent_65%)]"
      />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/msign.svg" alt="MSIGN" className="h-10 w-auto drop-shadow-[0_8px_20px_rgba(91,87,232,0.35)]" />
          <p className="eyebrow">Signage Console</p>
        </div>
        <Card className="w-full rounded-[26px] shadow-float [--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-[22px] font-extrabold tracking-[-0.02em]">Sign in</CardTitle>
            <CardDescription className="text-[15px]">Manage what the TVs in your store show.</CardDescription>
          </CardHeader>
          <CardContent>
            {invalidLink ? (
              <p className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                This invite link is invalid or has expired.
              </p>
            ) : null}
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email" className="text-[15px]">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourbusiness.com"
                  required
                  autoFocus
                  disabled={pending}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password" className="text-[15px]">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={pending}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button type="submit" size="xl" className="mt-1 w-full" disabled={pending || !email || !password}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-[13px] text-muted-foreground">
          Set up by MTech Distributors · Need help?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  )
}

/**
 * GET /auth/confirm — invite/recovery email link target (docs/CONTRACTS.md §5.21).
 * Verifies the OTP with the session-bound server client (verifyOtp sets the auth
 * cookies through the cookie adapter), then redirects to `next` (default /screens;
 * must start with '/' and not '//'). Any failure → /login?error=invalid_link.
 * Uses NextResponse.redirect — never next/navigation redirect() here.
 */
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

const OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value)
}

function safeNext(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/tvs'
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const next = safeNext(params.get('next'))

  if (tokenHash && isOtpType(type)) {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, request.url))
    console.warn('[auth/confirm] verifyOtp failed', error.message)
  }
  return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
}

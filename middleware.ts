import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PREFIXES = ['/player', '/api/device/', '/api/cron/', '/auth/confirm', '/_next/']
const PUBLIC_PATHS = new Set(['/login', '/auth/confirm', '/player', '/privacy', '/favicon.ico', '/manifest.webmanifest'])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/** Copy refreshed auth cookies from the session response onto a redirect/JSON response. */
function withCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie)
  }
  return to
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl
  const { response, user } = await updateSession(request)

  if (isPublicPath(pathname)) {
    if (user && pathname === '/login') {
      // "/" picks the landing page by role (app/page.tsx).
      return withCookies(response, NextResponse.redirect(new URL('/', request.url)))
    }
    return response
  }

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return withCookies(
        response,
        NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 }),
      )
    }
    const login = new URL('/login', request.url)
    login.searchParams.set('next', `${pathname}${search}`)
    return withCookies(response, NextResponse.redirect(login))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|woff2?)$).*)',
  ],
}

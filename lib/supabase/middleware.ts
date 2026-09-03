import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient as ssrServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

/**
 * Refreshes the Supabase auth cookies on every matched request (the @supabase/ssr 0.12
 * getAll/setAll pattern) and returns the verified user (auth.getUser(), never getSession()).
 * The returned response carries the refreshed cookies and MUST be the one sent (or copied from).
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.error('[middleware] Supabase env vars are not set')
    return { response, user: null }
  }

  const supabase = ssrServerClient<Database>(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Do not run code between client creation and getUser(): it can cause random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}

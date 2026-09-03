import { cookies } from 'next/headers'
import { createServerClient as ssrServerClient } from '@supabase/ssr'
import type { Database, DbClient } from '@/types/db'

/**
 * Session-bound server client (RLS enforced). Use in server components, layouts and route
 * handlers. Never import from a 'use client' file.
 */
export async function createServerClient(): Promise<DbClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
  }
  const cookieStore = await cookies()

  return ssrServerClient<Database>(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component: cookies cannot be set there. The middleware
          // (updateSession) refreshes the session cookies instead, so this is safe to ignore.
        }
      },
    },
  })
}

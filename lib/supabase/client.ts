'use client'

import { createBrowserClient as ssrBrowserClient } from '@supabase/ssr'
import type { Database, DbClient } from '@/types/db'

let browserClient: DbClient | null = null

/** Browser Supabase client (anon key, session from cookies). Module singleton. */
export function createBrowserClient(): DbClient {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
  }
  browserClient = ssrBrowserClient<Database>(url, anon)
  return browserClient
}

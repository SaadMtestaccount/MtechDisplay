'use client'

/**
 * hooks/useApp.ts — owns the app context object and its value type. AppProvider
 * (components/shell/AppProvider.tsx) imports AppContext from here — never the reverse,
 * so no module cycle exists (docs/CONTRACTS.md §8).
 */
import { createContext, useContext } from 'react'
import type { AppBootstrap } from '@/types/api'

export type AppContextValue = AppBootstrap & {
  /** POST /api/orgs/active then router.refresh(); the new org arrives via the server layout. */
  setActiveOrg(orgId: string): Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside <AppProvider>')
  return value
}

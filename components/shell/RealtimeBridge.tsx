'use client'

import type { ReactNode } from 'react'
import { useApp } from '@/hooks/useApp'
import { RealtimeContext, useOrgRealtime } from '@/hooks/useRealtimeScreens'

/**
 * Mounted once by AppProvider: holds the single org-channel subscription so every admin
 * page gets `changed` invalidation for free and reads statuses via useRealtimeScreens().
 */
export function RealtimeBridge({ children }: { children: ReactNode }) {
  const { org } = useApp()
  const value = useOrgRealtime(org?.id ?? null)
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

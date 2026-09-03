'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import { RealtimeBridge } from '@/components/shell/RealtimeBridge'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppContext, type AppContextValue } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import type { ActiveOrgResponse, AppBootstrap } from '@/types/api'

export function AppProvider({ value, children }: { value: AppBootstrap; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }),
  )
  const router = useRouter()

  const contextValue = useMemo<AppContextValue>(
    () => ({
      ...value,
      setActiveOrg: async (orgId: string) => {
        await apiFetch<ActiveOrgResponse>('/api/orgs/active', { method: 'POST', json: { org_id: orgId } })
        router.refresh()
      },
    }),
    [value, router],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <AppContext.Provider value={contextValue}>
            <RealtimeBridge>{children}</RealtimeBridge>
          </AppContext.Provider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Page body; the bottom padding under `md` keeps content clear of the floating MobileTabBar. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto max-w-7xl px-4 pt-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-6 md:pb-6', className)}>
      {children}
    </div>
  )
}

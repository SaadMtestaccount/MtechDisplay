import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Page body; the bottom padding under `md` keeps content clear of MobileTabBar. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 md:pb-6', className)}>{children}</div>
}

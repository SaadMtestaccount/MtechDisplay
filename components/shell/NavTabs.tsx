'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isActiveTab, tabsFor } from '@/components/shell/nav-tabs'
import { useApp } from '@/hooks/useApp'
import { cn } from '@/lib/utils'

/** Desktop tab strip; the mobile bottom bar (MobileTabBar) renders the same list under `md`. */
export function NavTabs() {
  const pathname = usePathname()
  const { profile } = useApp()
  const tabs = tabsFor(pathname, profile.is_super_admin)

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {tabs.map((tab) => {
        const active = isActiveTab(tab, pathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex h-9 items-center rounded-lg px-3.5 text-[15px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              active && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

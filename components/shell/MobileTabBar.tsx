'use client'

/**
 * components/shell/MobileTabBar.tsx — phone navigation (docs/CONTRACTS.md §23): a fixed bottom
 * bar with the same tabs as the navbar, icon + word, thumb-sized. Hidden from `md` up, where
 * NavTabs takes over. PageContainer reserves space for it.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isActiveTab, tabsFor } from '@/components/shell/nav-tabs'
import { useApp } from '@/hooks/useApp'
import { cn } from '@/lib/utils'

export function MobileTabBar() {
  const pathname = usePathname()
  const { profile } = useApp()
  const tabs = tabsFor(pathname, profile.is_super_admin)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const active = isActiveTab(tab, pathname)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-6" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

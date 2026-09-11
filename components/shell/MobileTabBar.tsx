'use client'

/**
 * components/shell/MobileTabBar.tsx — phone navigation (docs/CONTRACTS.md §23): a floating
 * frosted bar with the same tabs as the navbar, icon + word, thumb-sized. Sits above the home
 * indicator (env(safe-area-inset-bottom)). Hidden from `md` up, where NavTabs takes over.
 * PageContainer reserves space for it.
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
      className="fixed inset-x-3 z-40 md:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}
    >
      <div
        className="glass grid rounded-[26px] p-1.5 shadow-float ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
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
                'pressable flex h-14 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold',
                active ? 'bg-primary/12 text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

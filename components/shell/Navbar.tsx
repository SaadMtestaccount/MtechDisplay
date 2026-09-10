'use client'

import { ShieldCheckIcon, StoreIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MobileTabBar } from '@/components/shell/MobileTabBar'
import { NavTabs } from '@/components/shell/NavTabs'
import { OrgSwitcher } from '@/components/shell/OrgSwitcher'
import { UserMenu } from '@/components/shell/UserMenu'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'

/**
 * Top bar (docs/CONTRACTS.md §23): wordmark, tabs (desktop), location switcher, profile menu.
 * A super admin also gets a switch between the two consoles: inside a location the bar shows
 * an "Admin" button (→ /admin/merchants); on /admin/* it shows "Open a location" (→ /tvs).
 * On phones the tabs move to MobileTabBar at the bottom.
 */
export function Navbar() {
  const { profile } = useApp()
  const pathname = usePathname()
  const adminMode = profile.is_super_admin && pathname.startsWith('/admin')

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6">
          <Link href={adminMode ? '/admin/merchants' : '/tvs'} className="flex shrink-0 items-center" aria-label="MSIGN home">
            <img src="/msign.svg" alt="MSIGN" className="h-6 w-auto" />
          </Link>
          <NavTabs />
          <div className="ml-auto flex items-center gap-2">
            {profile.is_super_admin ? (
              <span className="hidden items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning lg:inline-flex">
                <ShieldCheckIcon className="size-3.5" /> Super admin
              </span>
            ) : null}
            {profile.is_super_admin ? (
              adminMode ? (
                <Button variant="outline" size="sm" render={<Link href="/tvs" />}>
                  <StoreIcon /> Open a location
                </Button>
              ) : (
                <Button variant="outline" size="sm" render={<Link href="/admin/merchants" />}>
                  <ShieldCheckIcon /> Admin
                </Button>
              )
            ) : null}
            {!adminMode ? (
              <div className="hidden sm:block">
                <OrgSwitcher />
              </div>
            ) : null}
            <UserMenu />
          </div>
        </div>
      </header>
      <MobileTabBar />
    </>
  )
}

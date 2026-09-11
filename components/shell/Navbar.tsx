'use client'

import { ArrowLeftIcon, EyeIcon, ShieldCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MobileTabBar } from '@/components/shell/MobileTabBar'
import { NavTabs } from '@/components/shell/NavTabs'
import { OrgSwitcher } from '@/components/shell/OrgSwitcher'
import { UserMenu } from '@/components/shell/UserMenu'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'

/**
 * Top bar (docs/CONTRACTS.md §23): wordmark, tabs (desktop), location switcher, profile menu.
 * A super admin lives on /admin/* and "views as" a merchant by opening one of its locations:
 * the admin bar offers an "Open a location" dropdown (every merchant's locations); inside a
 * location an amber bar names the store being viewed, offers the switcher, and links back to
 * Merchants. Managers never see any of that. On phones the tabs move to MobileTabBar.
 */
export function Navbar() {
  const { org, profile } = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const adminMode = profile.is_super_admin && pathname.startsWith('/admin')
  const viewingAs = profile.is_super_admin && !adminMode

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6">
          <Link href={profile.is_super_admin ? '/admin/merchants' : '/tvs'} className="flex shrink-0 items-center" aria-label="MSIGN home">
            <img src="/msign.svg" alt="MSIGN" className="h-6 w-auto" />
          </Link>
          <NavTabs />
          <div className="ml-auto flex items-center gap-2">
            {adminMode ? (
              <>
                <span className="hidden items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning lg:inline-flex">
                  <ShieldCheckIcon className="size-3.5" /> Super admin
                </span>
                <OrgSwitcher label="Open a location" onSelected={() => router.push('/tvs')} />
              </>
            ) : profile.is_super_admin ? null : (
              <div className="hidden sm:block">
                <OrgSwitcher />
              </div>
            )}
            <UserMenu />
          </div>
        </div>
        {viewingAs ? (
          <div className="border-t border-warning/30 bg-warning-soft" data-testid="viewing-as-bar">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 text-sm text-warning sm:px-6">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <EyeIcon className="size-4" /> Viewing {org?.name ?? 'a location'} as the merchant sees it
              </span>
              <span className="ml-auto flex items-center gap-2">
                <OrgSwitcher label="Switch location" onSelected={() => router.push('/tvs')} />
                <Button variant="outline" size="sm" render={<Link href="/admin/merchants" />}>
                  <ArrowLeftIcon /> Back to Merchants
                </Button>
              </span>
            </div>
          </div>
        ) : null}
      </header>
      <MobileTabBar />
    </>
  )
}

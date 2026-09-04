'use client'

import Link from 'next/link'
import { NavTabs } from '@/components/shell/NavTabs'
import { OrgSwitcher } from '@/components/shell/OrgSwitcher'
import { UserMenu } from '@/components/shell/UserMenu'

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-6">
        <Link href="/tvs" className="flex shrink-0 items-center" aria-label="MSIGN home">
          <img src="/msign.svg" alt="MSIGN" className="h-6 w-auto" />
        </Link>
        <NavTabs />
        <div className="ml-auto flex items-center gap-2">
          <OrgSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

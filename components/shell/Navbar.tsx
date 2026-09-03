'use client'

import Link from 'next/link'
import { AdminMenu } from '@/components/shell/AdminMenu'
import { NavTabs } from '@/components/shell/NavTabs'
import { OrgSwitcher } from '@/components/shell/OrgSwitcher'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { UserAvatar } from '@/components/shell/UserAvatar'
import { useApp } from '@/hooks/useApp'

export function Navbar() {
  const { user, profile } = useApp()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-6">
        <Link href="/screens" className="flex shrink-0 items-center" aria-label="MSIGN home">
          <img src="/msign.svg" alt="MSIGN" className="h-6 w-auto" />
        </Link>
        <NavTabs />
        <div className="ml-auto flex items-center gap-2">
          <OrgSwitcher />
          <AdminMenu />
          <ThemeToggle />
          <UserAvatar name={profile.full_name} email={user.email} />
        </div>
      </div>
    </header>
  )
}

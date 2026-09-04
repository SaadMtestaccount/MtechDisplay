'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/tvs', label: 'TVs', match: ['/tvs', '/screens', '/wall', '/groups'] },
  { href: '/content', label: 'Content', match: ['/content', '/websites'] },
  { href: '/menus', label: 'Menus', match: ['/menus'] },
] as const

export function NavTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex h-14 items-center">
      {TABS.map((tab) => {
        const active = tab.match.some((m) => pathname.startsWith(m))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative flex h-14 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
              active && 'text-primary hover:text-primary',
            )}
          >
            {tab.label}
            {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
          </Link>
        )
      })}
    </nav>
  )
}

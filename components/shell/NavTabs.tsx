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
    <nav className="flex items-center gap-1">
      {TABS.map((tab) => {
        const active = tab.match.some((m) => pathname.startsWith(m))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex h-8 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
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

'use client'

/** components/content/ContentSubnav.tsx — switch between the kinds of content in one place (§23). */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/photos', label: 'Photos & videos', match: ['/photos'] },
  { href: '/websites', label: 'Web pages', match: ['/websites'] },
  { href: '/content', label: 'Advanced library', match: ['/content'] },
] as const

export function ContentSubnav() {
  const pathname = usePathname()
  return (
    <div className="mb-5 inline-flex gap-1 rounded-lg border border-border bg-card p-1">
      {ITEMS.map((item) => {
        const active = item.match.some((m) => pathname.startsWith(m))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

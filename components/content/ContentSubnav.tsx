'use client'

/** components/content/ContentSubnav.tsx — switch between the two kinds of content in one place. */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/content', label: 'Images & Videos' },
  { href: '/websites', label: 'Web pages' },
] as const

export function ContentSubnav() {
  const pathname = usePathname()
  return (
    <div className="mb-5 inline-flex gap-1 rounded-lg border border-border bg-card p-1">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href)
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

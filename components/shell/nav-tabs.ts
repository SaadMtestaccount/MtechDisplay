/**
 * components/shell/nav-tabs.ts — the two tab sets of the console (docs/CONTRACTS.md §23).
 * Merchants (and super admins working inside a location) see TVs · Menus · Photos · Help.
 * Super admins on /admin/* see Merchants · All TVs · Staff · Settings. No React here so the
 * navbar, the mobile bottom bar and tests share one list.
 */
import type { LucideIcon } from 'lucide-react'
import {
  CircleHelpIcon, ImageIcon, ListIcon, MonitorIcon, SettingsIcon, StoreIcon, TvIcon, UsersIcon,
} from 'lucide-react'

export type NavTab = { href: string; label: string; match: readonly string[]; icon: LucideIcon }

export const MERCHANT_TABS: readonly NavTab[] = [
  { href: '/tvs', label: 'TVs', match: ['/tvs', '/screens', '/wall', '/groups'], icon: TvIcon },
  { href: '/menus', label: 'Menus', match: ['/menus'], icon: ListIcon },
  { href: '/photos', label: 'Photos', match: ['/photos', '/content', '/websites'], icon: ImageIcon },
  { href: '/help', label: 'Help', match: ['/help'], icon: CircleHelpIcon },
]

export const ADMIN_TABS: readonly NavTab[] = [
  { href: '/admin/merchants', label: 'Merchants', match: ['/admin/merchants', '/admin/orgs'], icon: StoreIcon },
  { href: '/admin/tvs', label: 'All TVs', match: ['/admin/tvs'], icon: MonitorIcon },
  { href: '/admin/users', label: 'Staff', match: ['/admin/users'], icon: UsersIcon },
  { href: '/admin/settings', label: 'Settings', match: ['/admin/settings'], icon: SettingsIcon },
]

/** Super admins get the admin set on /admin/*; everyone else (and admins inside a location) the merchant set. */
export function tabsFor(pathname: string, isSuperAdmin: boolean): readonly NavTab[] {
  return isSuperAdmin && pathname.startsWith('/admin') ? ADMIN_TABS : MERCHANT_TABS
}

export function isActiveTab(tab: NavTab, pathname: string): boolean {
  return tab.match.some((m) => pathname === m || pathname.startsWith(`${m}/`) || pathname.startsWith(`${m}?`))
}

import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSessionUser } from '@/lib/auth'

/**
 * Staff-only sub-shell for /admin/* (Merchants, All TVs, Staff, Settings). The outer (admin)
 * layout admits store managers for the merchant console; this one keeps the staff pages to
 * super admins (§14, §23).
 */
export default async function AdminStaffLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser()
  if (!session?.profile.is_super_admin) redirect('/tvs')
  return <>{children}</>
}

import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSessionUser } from '@/lib/auth'

/**
 * Staff-only sub-shell for /admin/* (Users, Organizations, Settings). The outer (admin) layout
 * admits store managers for the Wall; this one keeps the staff pages to super admins (§14).
 */
export default async function AdminStaffLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser()
  if (!session?.profile.is_super_admin) redirect('/wall')
  return <>{children}</>
}

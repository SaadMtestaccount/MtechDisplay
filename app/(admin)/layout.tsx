import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppProvider } from '@/components/shell/AppProvider'
import { Navbar } from '@/components/shell/Navbar'
import { PageContainer } from '@/components/shell/PageContainer'
import { getSessionUser } from '@/lib/auth'
import { getActiveOrg, getMembershipRole, listVisibleOrgs } from '@/lib/orgs'

/**
 * Admin shell (docs/CONTRACTS.md Appendix B): session → orgs → role → AppProvider + Navbar.
 * Access: super admins (MTech staff) and store managers (membership role admin/owner) reach the
 * console; merchant/TV-only accounts (role member, or no membership) are sent to /player (§14).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser()
  if (!session) redirect('/login')

  const orgs = await listVisibleOrgs(session.supabase)
  const org = await getActiveOrg(session.supabase)
  const role = org ? await getMembershipRole(session.supabase, org.id, session.user.id) : null
  const canManage = session.profile.is_super_admin || role === 'owner' || role === 'admin'
  if (!canManage) redirect('/player')

  return (
    <AppProvider
      value={{
        user: { id: session.user.id, email: session.user.email ?? '' },
        profile: session.profile,
        org,
        orgs,
        role,
      }}
    >
      <Navbar />
      <PageContainer>{children}</PageContainer>
    </AppProvider>
  )
}

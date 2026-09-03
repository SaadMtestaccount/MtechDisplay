import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppProvider } from '@/components/shell/AppProvider'
import { Navbar } from '@/components/shell/Navbar'
import { PageContainer } from '@/components/shell/PageContainer'
import { getSessionUser } from '@/lib/auth'
import { getActiveOrg, listVisibleOrgs } from '@/lib/orgs'

/** Admin shell (docs/CONTRACTS.md Appendix B): session → orgs → AppProvider + Navbar. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser()
  if (!session) redirect('/login')
  // Merchant accounts are TV-only (addendum §13): the admin shell is staff-only.
  if (!session.profile.is_super_admin) redirect('/player')

  const orgs = await listVisibleOrgs(session.supabase)
  const org = await getActiveOrg(session.supabase)

  return (
    <AppProvider
      value={{
        user: { id: session.user.id, email: session.user.email ?? '' },
        profile: session.profile,
        org,
        orgs,
      }}
    >
      <Navbar />
      <PageContainer>{children}</PageContainer>
    </AppProvider>
  )
}

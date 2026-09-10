import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'

/** Landing (docs/CONTRACTS.md §23): MTech staff start on Merchants; everyone else on their TVs. */
export default async function Home() {
  const session = await getSessionUser()
  if (!session) redirect('/login')
  redirect(session.profile.is_super_admin ? '/admin/merchants' : '/tvs')
}

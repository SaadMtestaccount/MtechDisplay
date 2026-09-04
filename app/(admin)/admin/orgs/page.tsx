import type { Metadata } from 'next'
import { OrgsPage } from '@/components/admin/OrgsPage'

export const metadata: Metadata = { title: 'Locations' }

export default function AdminOrgsPage() {
  return <OrgsPage />
}

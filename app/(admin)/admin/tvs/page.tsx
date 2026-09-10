import type { Metadata } from 'next'
import { FleetPage } from '@/components/admin/FleetPage'

export const metadata: Metadata = { title: 'All TVs' }

export default function Page() {
  return <FleetPage />
}

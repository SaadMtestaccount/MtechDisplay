import type { Metadata } from 'next'
import { MerchantsPage } from '@/components/admin/MerchantsPage'

export const metadata: Metadata = { title: 'Merchants' }

export default function Page() {
  return <MerchantsPage />
}

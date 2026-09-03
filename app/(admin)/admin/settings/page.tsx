import type { Metadata } from 'next'
import { SettingsPage } from '@/components/admin/SettingsPage'

export const metadata: Metadata = { title: 'Settings' }

export default function AdminSettingsPage() {
  return <SettingsPage />
}

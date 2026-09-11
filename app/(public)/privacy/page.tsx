import type { Metadata } from 'next'
import { PrivacyPolicy } from '@/components/legal/PrivacyPolicy'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How MSIGN by MTech Distributors handles your information.',
}

/** /privacy — public (middleware PUBLIC_PATHS); the App Store / Play listing links here. */
export default function PrivacyPage() {
  return <PrivacyPolicy />
}

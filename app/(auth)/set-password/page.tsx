import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SetPasswordForm } from '@/components/auth/SetPasswordForm'

export const metadata: Metadata = { title: 'Set password' }

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  )
}

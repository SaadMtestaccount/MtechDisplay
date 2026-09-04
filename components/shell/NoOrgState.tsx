'use client'

import { Building2Icon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shell/EmptyState'

/** Rendered by every org page when `useApp().org` is null. */
export function NoOrgState() {
  return (
    <EmptyState
      icon={<Building2Icon />}
      title="No locations yet"
      description="Add your first merchant on the Team page — that creates their login and first location together."
      action={<Button render={<Link href="/admin/users" />}>Go to Team</Button>}
    />
  )
}

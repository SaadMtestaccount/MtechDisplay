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
      title="No organization yet"
      description="Create an organization to get started."
      action={<Button render={<Link href="/admin/orgs" />}>Go to Organizations</Button>}
    />
  )
}

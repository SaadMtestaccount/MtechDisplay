'use client'

import { PlusIcon } from 'lucide-react'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'

/** Zero-groups state (spec §9 — the copy is exact). Illustration is slice A's file. */
export function GroupsEmptyState({ onCreate }: { onCreate(): void }) {
  return (
    <EmptyState
      illustration={<img src="/illustrations/groups.svg" alt="" className="h-40 w-auto" />}
      title="Group your screens"
      description="If you have multiple screens with the same playlist, a screen group allows you to manage them all in one place. Simply create a group playlist, and then assign screens to the group."
      action={
        <Button onClick={onCreate}>
          <PlusIcon />
          Add Screen Group
        </Button>
      }
    />
  )
}

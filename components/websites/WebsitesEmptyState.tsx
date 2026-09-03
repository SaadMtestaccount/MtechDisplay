'use client'

import { GlobeIcon, PlusIcon } from 'lucide-react'
import { EmptyState } from '@/components/shell/EmptyState'
import { Button } from '@/components/ui/button'

/** Empty /websites state — exact spec copy (docs/CONTRACTS.md §9.3). */
export function WebsitesEmptyState({ onCreate }: { onCreate(): void }) {
  return (
    <EmptyState
      icon={<GlobeIcon />}
      title="No websites yet"
      description="Websites are just as easy to display on your screens as images and videos. Simply add a website here, then drag it into the playlist of any screen."
      action={
        <Button onClick={onCreate}>
          <PlusIcon />
          Add Website
        </Button>
      }
    />
  )
}

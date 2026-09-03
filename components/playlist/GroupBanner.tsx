import { UsersIcon } from 'lucide-react'
import Link from 'next/link'

/**
 * Purple banner above the editor on a grouped screen (docs/CONTRACTS.md §9.5): the editor
 * below edits the GROUP playlist, so changes reach every screen in the group.
 */
export function GroupBanner({ groupName, groupId }: { groupName: string; groupId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
      <UsersIcon className="size-4 shrink-0 text-primary" />
      <span className="min-w-0">
        This screen plays group <span className="font-semibold">“{groupName}”</span> — edits here
        affect every screen in that group.
      </span>
      <Link
        href={`/groups/${groupId}`}
        className="ml-auto shrink-0 font-medium text-primary underline-offset-4 hover:underline"
      >
        Open group
      </Link>
    </div>
  )
}

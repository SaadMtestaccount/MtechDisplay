'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { initials } from '@/lib/utils'

export function UserAvatar({ name, email }: { name: string | null; email: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex cursor-default rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} />
        }
      >
        <Avatar>
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary dark:bg-primary/25 dark:text-primary-foreground">
            {initials(name ?? email)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side="bottom">{name ? `${name} — ${email}` : email}</TooltipContent>
    </Tooltip>
  )
}

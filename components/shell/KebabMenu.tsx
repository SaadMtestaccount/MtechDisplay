'use client'

import { MoreVerticalIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type KebabItem = {
  label: string
  icon?: ReactNode
  onSelect(): void
  destructive?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

export function KebabMenu({
  items,
  align = 'end',
  label = 'More actions',
}: {
  items: KebabItem[]
  align?: 'start' | 'end'
  label?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            // Kebabs live inside clickable cards — never trigger the card's own onClick.
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        {items.map((item) => (
          <Fragment key={item.label}>
            {item.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant={item.destructive ? 'destructive' : 'default'}
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation()
                item.onSelect()
              }}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

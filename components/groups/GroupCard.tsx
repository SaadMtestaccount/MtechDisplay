'use client'

import { ListVideoIcon, MonitorIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { GroupView } from '@/types/api'

/** List-page card: name, screen count, online/offline dots, kebab. Card click → edit. */
export function GroupCard({
  group,
  onAction,
}: {
  group: GroupView
  onAction(action: 'edit' | 'rename' | 'screens' | 'delete'): void
}) {
  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      onClick={() => onAction('edit')}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onAction('edit')
        }
      }}
      className="cursor-pointer transition-shadow outline-none hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader>
        <CardTitle className="truncate">{group.name}</CardTitle>
        <CardDescription>
          {group.screen_count} {group.screen_count === 1 ? 'screen' : 'screens'}
        </CardDescription>
        <CardAction>
          <KebabMenu
            items={[
              { label: 'Edit playlist', icon: <ListVideoIcon />, onSelect: () => onAction('edit') },
              { label: 'Rename', icon: <PencilIcon />, onSelect: () => onAction('rename') },
              { label: 'Manage screens', icon: <MonitorIcon />, onSelect: () => onAction('screens') },
              {
                label: 'Delete',
                icon: <Trash2Icon />,
                destructive: true,
                separatorBefore: true,
                onSelect: () => onAction('delete'),
              },
            ]}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-online" aria-hidden />
          {group.online_count} online
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-offline" aria-hidden />
          {group.offline_count} offline
        </span>
      </CardContent>
    </Card>
  )
}

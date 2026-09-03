'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GroupView, ScreenListQuery } from '@/types/api'

/** Filters popover body for the screens list: status (online/offline) + group ('none' = ungrouped). */
export function ScreenFilters({
  value,
  groups,
  onChange,
}: {
  value: ScreenListQuery
  groups: GroupView[]
  onChange(next: ScreenListQuery): void
}) {
  const active = (value.status !== undefined ? 1 : 0) + (value.group_id !== undefined ? 1 : 0)

  return (
    <div className="flex w-52 flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="screen-status-filter">Status</Label>
        <Select
          value={value.status ?? 'any'}
          onValueChange={(v) => {
            const s = String(v)
            onChange({ ...value, status: s === 'online' ? 'online' : s === 'offline' ? 'offline' : undefined })
          }}
        >
          <SelectTrigger id="screen-status-filter" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="screen-group-filter">Group</Label>
        <Select
          value={value.group_id ?? 'all'}
          onValueChange={(v) => {
            const s = String(v)
            onChange({ ...value, group_id: s === 'all' ? undefined : s })
          }}
        >
          <SelectTrigger id="screen-group-filter" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            <SelectItem value="none">No group</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {active > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...value, status: undefined, group_id: undefined })}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}

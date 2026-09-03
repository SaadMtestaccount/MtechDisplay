'use client'

import { LayersIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GroupView } from '@/types/api'

/** Screen → group assignment. The 'none' sentinel string maps to a null group_id. */
export function GroupSelect({
  value,
  groups,
  onChange,
}: {
  value: string | null
  groups: GroupView[]
  onChange(v: string | null): void
}) {
  return (
    <Select
      value={value ?? 'none'}
      onValueChange={(v) => {
        const next = String(v) === 'none' ? null : String(v)
        if (next !== value) onChange(next)
      }}
    >
      <SelectTrigger size="sm" aria-label="Group">
        <LayersIcon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No group</SelectItem>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

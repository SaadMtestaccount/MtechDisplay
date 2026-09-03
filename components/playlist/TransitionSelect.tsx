'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TransitionType } from '@/types/db'

const LABELS: Record<TransitionType, string> = { fade: 'Fade', none: 'None' }

/** Per-item transition (docs/CONTRACTS.md §9.5): fade (300 ms crossfade) or none. */
export function TransitionSelect({
  value,
  onChange,
}: {
  value: TransitionType
  onChange(v: TransitionType): void
}) {
  return (
    <Select
      value={value}
      items={LABELS}
      onValueChange={(v) => {
        if (v === 'fade' || v === 'none') onChange(v)
      }}
    >
      <SelectTrigger size="sm" aria-label="Transition" className="w-[84px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="fade">Fade</SelectItem>
        <SelectItem value="none">None</SelectItem>
      </SelectContent>
    </Select>
  )
}

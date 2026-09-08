'use client'

import { RectangleHorizontalIcon, RectangleVerticalIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isOrientation } from '@/lib/utils'
import { ORIENTATIONS, type Orientation } from '@/types/api'

const LABELS: Record<Orientation, string> = {
  landscape: 'Landscape',
  portrait: 'Portrait (vertical)',
}

/** Landscape / Portrait select. Portrait = an upright 9:16 stage; use Rotation for how a TV is mounted. */
export function OrientationSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange(v: Orientation): void
  disabled?: boolean
}) {
  const current: Orientation = isOrientation(value) ? value : 'landscape'
  const Icon = current === 'portrait' ? RectangleVerticalIcon : RectangleHorizontalIcon
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const next = String(v)
        if (isOrientation(next) && next !== current) onChange(next)
      }}
      disabled={disabled}
    >
      <SelectTrigger size="sm" aria-label="Orientation">
        <Icon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORIENTATIONS.map((o) => (
          <SelectItem key={o} value={o}>
            {LABELS[o]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

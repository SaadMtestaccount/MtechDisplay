'use client'

import { RotateCwIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isRotation } from '@/lib/utils'
import { ROTATIONS, type Rotation } from '@/types/api'

/** 0/90/180/270 select; values travel as strings (base-nova Select) and parse back via isRotation. */
export function RotationSelect({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange(v: Rotation): void
  disabled?: boolean
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => {
        const parsed = Number(String(v))
        if (isRotation(parsed) && parsed !== value) onChange(parsed)
      }}
      disabled={disabled}
    >
      <SelectTrigger size="sm" aria-label="Rotation">
        <RotateCwIcon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROTATIONS.map((rotation) => (
          <SelectItem key={rotation} value={String(rotation)}>
            {rotation === 0 ? '0° (not rotated)' : `${rotation}°`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

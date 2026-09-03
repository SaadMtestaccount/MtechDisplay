'use client'

import { Input } from '@/components/ui/input'

/**
 * Seconds-on-screen input (docs/CONTRACTS.md §9.5). `value` null = use the default shown as
 * `placeholder` (videos: the detected source duration; images/websites: 10 s) — typing sets
 * an override, clearing restores the default.
 */
export function DurationInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | null
  placeholder: number
  onChange(v: number | null): void
}) {
  return (
    <div className="relative shrink-0" title="Seconds on screen">
      <Input
        type="number"
        min={1}
        max={86_400}
        step={1}
        inputMode="numeric"
        value={value ?? ''}
        placeholder={String(placeholder)}
        aria-label="Duration in seconds"
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(null)
            return
          }
          const n = Math.floor(Number(raw))
          onChange(Number.isFinite(n) ? Math.min(86_400, Math.max(1, n)) : null)
        }}
        className="h-7 w-[76px] pr-5 text-right text-sm tabular-nums"
      />
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
        s
      </span>
    </div>
  )
}

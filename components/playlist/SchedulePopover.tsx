'use client'

import { CalendarClockIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { describeSchedule, hasSchedule } from '@/lib/schedule'
import { cn, fromDateString, toDateString } from '@/lib/utils'
import type { ManifestSchedule } from '@/types/api'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const CLEARED: ManifestSchedule = {
  active_from: null,
  active_to: null,
  days_of_week: null,
  daily_start: null,
  daily_end: null,
}

/**
 * Per-item schedule (docs/CONTRACTS.md §9.5): Calendar date range (toDateString /
 * fromDateString — never toISOString), days-of-week checkboxes 0–6, daily start/end
 * <input type="time"> ('HH:MM'), summary via describeSchedule.
 */
export function SchedulePopover({
  value,
  onChange,
}: {
  value: ManifestSchedule
  onChange(v: ManifestSchedule): void
}) {
  const scheduled = hasSchedule(value)
  const summary = describeSchedule(value)

  const from = value.active_from ? fromDateString(value.active_from.slice(0, 10)) : undefined
  const to = value.active_to ? fromDateString(value.active_to.slice(0, 10)) : undefined
  const selected: DateRange | undefined = from || to ? { from: from ?? to, to } : undefined

  const setDays = (day: number, checked: boolean) => {
    const next = new Set(value.days_of_week ?? [])
    if (checked) next.add(day)
    else next.delete(day)
    const arr = Array.from(next).sort((a, b) => a - b)
    onChange({ ...value, days_of_week: arr.length > 0 ? arr : null })
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Schedule"
            title={summary}
            className={cn('max-w-44 shrink-0', !scheduled && 'text-muted-foreground')}
          />
        }
      >
        <CalendarClockIcon className="size-3.5" />
        <span className="truncate">{summary}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">Date range</p>
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={from ?? to ?? new Date()}
              selected={selected}
              onSelect={(range) =>
                onChange({
                  ...value,
                  active_from: range?.from ? toDateString(range.from) : null,
                  active_to: range?.to ? toDateString(range.to) : null,
                })
              }
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Days of week</p>
            <div className="flex items-start justify-between gap-1">
              {DAY_LABELS.map((label, day) => (
                <label key={label} className="flex flex-col items-center gap-1.5 text-[10px] text-muted-foreground">
                  {label}
                  <Checkbox
                    checked={value.days_of_week?.includes(day) ?? false}
                    onCheckedChange={(checked) => setDays(day, checked === true)}
                    aria-label={label}
                  />
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
              Start time
              <Input
                type="time"
                value={(value.daily_start ?? '').slice(0, 5)}
                onChange={(e) => onChange({ ...value, daily_start: e.target.value || null })}
                className="h-7"
              />
            </label>
            <span className="pb-1.5 text-muted-foreground">–</span>
            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
              End time
              <Input
                type="time"
                value={(value.daily_end ?? '').slice(0, 5)}
                onChange={(e) => onChange({ ...value, daily_end: e.target.value || null })}
                className="h-7"
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={summary}>
              {summary}
            </p>
            <Button variant="ghost" size="xs" disabled={!scheduled} onClick={() => onChange({ ...CLEARED })}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

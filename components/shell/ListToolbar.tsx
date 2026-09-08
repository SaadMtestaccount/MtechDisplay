'use client'

import { ArrowUpDownIcon, ListFilterIcon, SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * Sort dropdown, Filters popover, Search input (debounced 300ms internally). No direction
 * control — `dir` is API-only (docs/CONTRACTS.md §0.6).
 */
export function ListToolbar({
  search,
  onSearchChange,
  sort,
  filters,
  activeFilterCount = 0,
}: {
  search: string
  onSearchChange(v: string): void
  sort: { value: string; options: { value: string; label: string }[]; onChange(v: string): void }
  filters?: ReactNode
  activeFilterCount?: number
}) {
  const [text, setText] = useState(search)
  const debounced = useDebounce(text, 300)
  const lastEmitted = useRef(search)

  useEffect(() => {
    if (debounced !== lastEmitted.current) {
      lastEmitted.current = debounced
      onSearchChange(debounced)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // External reset (e.g. clearing filters) — never clobber in-flight typing.
  useEffect(() => {
    if (search !== lastEmitted.current) {
      lastEmitted.current = search
      setText(search)
    }
  }, [search])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={sort.value} onValueChange={(v) => sort.onChange(String(v))}>
        <SelectTrigger size="sm" aria-label="Sort">
          <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sort.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filters ? (
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <ListFilterIcon className="size-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="end">{filters}</PopoverContent>
        </Popover>
      ) : null}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search…"
          aria-label="Search"
          className="h-8 w-48 rounded-full pl-8 md:w-56"
        />
      </div>
    </div>
  )
}

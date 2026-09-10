'use client'

/**
 * components/admin/LocationPanel.tsx — one location inside MerchantManageDialog (§19): its name
 * (click to rename → PATCH /api/orgs/[id]), TV + content counts, who can reach it, and "Open in
 * console" (switch the console to that location). Panels sit side by side in a grid.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, ImageIcon, MapPinIcon, PencilIcon, TvIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { EmployeeView, MerchantLocation } from '@/types/api'
import type { Organization } from '@/types/db'

export function LocationPanel({
  location,
  staff,
  onOpen,
  onRenamed,
}: {
  location: MerchantLocation
  staff: EmployeeView[]
  onOpen(): void
  onRenamed(name: string): void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)

  const rename = useMutation({
    mutationFn: (next: string) =>
      apiFetch<Organization>(`/api/orgs/${location.id}`, { method: 'PATCH', json: { name: next } }),
    onSuccess: (org) => {
      onRenamed(org.name)
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      toast.success('Location renamed')
    },
    onError: (e) => {
      setName(location.name)
      setEditing(false)
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    },
  })

  const commit = () => {
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed === location.name) {
      setName(location.name)
      setEditing(false)
      return
    }
    rename.mutate(trimmed)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-start gap-2">
        <MapPinIcon className="mt-1 size-4 shrink-0 text-primary" />
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setName(location.name)
                setEditing(false)
              }
            }}
            maxLength={120}
            autoFocus
            aria-label="Location name"
            className="h-8"
            disabled={rename.isPending}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="group flex min-w-0 flex-1 items-center gap-1.5 rounded text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{location.name}</span>
            <PencilIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <TvIcon className="size-3.5" /> {location.screen_count} {location.screen_count === 1 ? 'TV' : 'TVs'}
          {location.paired_count > 0 ? (
            <span className={location.online_count < location.paired_count ? 'font-semibold text-offline' : 'text-online'}>
              {' '}
              · {location.online_count} of {location.paired_count} on
            </span>
          ) : location.screen_count > 0 ? (
            <span> · none signed in yet</span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="size-3.5" /> {location.content_count} {location.content_count === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">Owner login</Badge>
        {staff.map((e) => (
          <Badge key={e.id} variant="outline" title={e.email}>
            {e.email.split('@')[0]} · {e.role === 'admin' ? 'Manager' : 'TV'}
          </Badge>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onOpen}>
        <ExternalLinkIcon /> Open in console
      </Button>
    </div>
  )
}

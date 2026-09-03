'use client'

import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { formatBytes, formatDuration } from '@/lib/utils'
import type { ContentView, UrlResponse } from '@/types/api'

/** Preview via a fresh 1h signed URL; videos get controls and autoplay (docs/CONTRACTS.md §9.2). */
export function PreviewModal({ item, onClose }: { item: ContentView | null; onClose(): void }) {
  const { org } = useApp()
  const orgId = org?.id ?? null

  const urlQuery = useQuery({
    queryKey: [...queryKeys.content.detail(orgId ?? '', item?.id ?? ''), 'url'],
    queryFn: () => apiFetch<UrlResponse>(`/api/content/${item?.id}/url`),
    enabled: orgId !== null && item !== null,
    staleTime: 30 * 60_000,
  })

  const meta = item
    ? [
        formatBytes(item.size_bytes),
        item.width !== null && item.height !== null ? `${item.width}×${item.height}` : null,
        item.type === 'video' ? formatDuration(item.duration_seconds) || null : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{item?.name}</DialogTitle>
          <DialogDescription>{meta}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-black/90">
          {urlQuery.isPending && item !== null ? (
            <Skeleton className="aspect-video w-full" />
          ) : urlQuery.isError ? (
            <p className="p-8 text-sm text-destructive">
              {urlQuery.error instanceof Error ? urlQuery.error.message : 'Could not load the preview.'}
            </p>
          ) : item !== null && urlQuery.data ? (
            item.type === 'video' ? (
              <video src={urlQuery.data.url} controls autoPlay playsInline className="max-h-[70vh] w-full" />
            ) : (
              <img src={urlQuery.data.url} alt={item.name} className="max-h-[70vh] w-auto max-w-full object-contain" />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

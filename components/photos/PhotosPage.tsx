'use client'

/**
 * components/photos/PhotosPage.tsx — /photos (docs/CONTRACTS.md §23): one giant upload box,
 * three filter chips, a grid of PhotoCards with "Use on a TV". Whole-org view (folders are an
 * advanced-library concept; MTech staff still reach /content).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { GlobeIcon, SlidersHorizontalIcon, UploadIcon } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { DeleteContentDialog } from '@/components/content/DeleteContentDialog'
import { PreviewModal } from '@/components/content/PreviewModal'
import { UploadDropzone } from '@/components/content/UploadDropzone'
import { UploadProgress } from '@/components/content/UploadProgress'
import { PhotoCard, type PhotoCardAction } from '@/components/photos/PhotoCard'
import { UseOnTvDialog } from '@/components/photos/UseOnTvDialog'
import { EmptyState } from '@/components/shell/EmptyState'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { RenameDialog } from '@/components/shell/RenameDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useUpload } from '@/hooks/useUpload'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { ACCEPTED_MIMES, type ContentListQuery, type ContentView } from '@/types/api'
import type { ContentType } from '@/types/db'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type Filter = 'all' | ContentType
const GRID = 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4'

export function PhotosPage() {
  const { org, profile } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [dialog, setDialog] = useState<{ kind: PhotoCardAction; item: ContentView } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const params: ContentListQuery = { sort: 'newest', expired: false, type: filter === 'all' ? undefined : filter }
  const contentQuery = useQuery({
    queryKey: queryKeys.content.list(orgId ?? '', params),
    queryFn: () => apiFetch<ContentView[]>(`/api/content${buildQuery({ ...params })}`),
    enabled: orgId !== null,
    placeholderData: keepPreviousData,
  })
  const countsQuery = useQuery({
    queryKey: queryKeys.content.list(orgId ?? '', { sort: 'newest', expired: false }),
    queryFn: () => apiFetch<ContentView[]>('/api/content?sort=newest'),
    enabled: orgId !== null,
  })
  const { uploads, addFiles, cancel, clearFinished } = useUpload({ orgId: orgId ?? '', folderId: null })

  if (!org) return <NoOrgState />

  const items = contentQuery.data ?? []
  const all = countsQuery.data ?? []
  const counts = {
    all: all.length,
    image: all.filter((c) => c.type === 'image').length,
    video: all.filter((c) => c.type === 'video').length,
  }
  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'image', label: `Photos (${counts.image})` },
    { key: 'video', label: `Videos (${counts.video})` },
  ]
  const close = (open: boolean) => {
    if (!open) setDialog(null)
  }

  const rename = async (value: string) => {
    if (!dialog) return
    try {
      await apiFetch<ContentView>(`/api/content/${dialog.item.id}`, { method: 'PATCH', json: { name: value } })
      if (orgId) void queryClient.invalidateQueries({ queryKey: queryKeys.content.all(orgId) })
      toast.success('Renamed')
      setDialog(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <UploadDropzone onFiles={addFiles}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-[30px] font-extrabold tracking-[-0.03em]">Photos &amp; videos</h1>
            <p className="text-[15px] text-muted-foreground">Everything you have uploaded. Put any of them on a TV or into a menu.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="lg" render={<Link href="/websites" />}>
              <GlobeIcon /> Web pages
            </Button>
            {profile.is_super_admin ? (
              <Button variant="ghost" size="lg" className="text-muted-foreground" render={<Link href="/content" />}>
                <SlidersHorizontalIcon /> Advanced library
              </Button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="pressable flex flex-col items-center gap-3 rounded-[22px] border-2 border-dashed border-primary/60 bg-primary/[0.06] px-4 py-7 text-center outline-none transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:justify-center sm:gap-5 sm:text-left"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-deep text-white shadow-primary">
            <UploadIcon className="size-7" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-xl font-extrabold tracking-tight sm:text-2xl">Click here to add photos or videos</span>
            <span className="text-[15px] text-muted-foreground">
              You can also drop files onto this page. JPG, PNG, MP4 and MOV. Vertical photos are fine too.
            </span>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_MIMES.join(',')}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) addFiles(files)
            e.target.value = ''
          }}
        />

        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                'pressable h-10 rounded-full border px-4 text-[15px] font-semibold transition-colors',
                filter === chip.key ? 'border-foreground bg-foreground text-background shadow-float' : 'border-border bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-muted',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {contentQuery.isPending ? (
          <div className={GRID}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-60 rounded-2xl" />
            ))}
          </div>
        ) : contentQuery.isError ? (
          <EmptyState title="Could not load your photos" description="Check your connection and reload the page." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<UploadIcon />}
            title={filter === 'all' ? 'No photos or videos yet' : filter === 'image' ? 'No photos yet' : 'No videos yet'}
            description="Use the big box above to add some."
          />
        ) : (
          <div className={GRID}>
            {items.map((item) => (
              <PhotoCard key={item.id} item={item} onAction={(kind) => setDialog({ kind, item })} />
            ))}
          </div>
        )}
      </div>

      <UploadProgress uploads={uploads} onCancel={cancel} onClear={clearFinished} />
      <UseOnTvDialog item={dialog?.kind === 'use' ? dialog.item : null} onOpenChange={close} />
      <PreviewModal item={dialog?.kind === 'preview' ? dialog.item : null} onClose={() => setDialog(null)} />
      <RenameDialog
        open={dialog?.kind === 'rename'}
        onOpenChange={close}
        title="Rename"
        initialValue={dialog?.kind === 'rename' ? dialog.item.name : ''}
        onSubmit={rename}
      />
      <DeleteContentDialog item={dialog?.kind === 'delete' ? dialog.item : null} onOpenChange={close} />
    </UploadDropzone>
  )
}

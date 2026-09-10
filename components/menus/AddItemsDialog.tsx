'use client'

/**
 * components/menus/AddItemsDialog.tsx — pick photos, videos or web pages to add to a menu
 * (docs/CONTRACTS.md §23). Multi-select grid with a checkmark per tile, an Upload button that
 * adds the new file straight into the selection, and one "Add N to menu" button.
 */
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, FilmIcon, GlobeIcon, ImageIcon, UploadIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WebsiteThumb } from '@/components/playlist/WebsiteThumb'
import type { LibraryPick } from '@/components/playlist/playlist-utils'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '@/hooks/useApp'
import { useUpload } from '@/hooks/useUpload'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn, formatDuration } from '@/lib/utils'
import { ACCEPTED_MIMES, type ContentView, type WebsiteView } from '@/types/api'

type Tab = 'media' | 'web'

export function AddItemsDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onAdd(picks: LibraryPick[]): void
}) {
  const { org } = useApp()
  const orgId = org?.id ?? ''
  const [tab, setTab] = useState<Tab>('media')
  const [selected, setSelected] = useState<Map<string, LibraryPick>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTab('media')
      setSelected(new Map())
    }
  }, [open])

  const contentQuery = useQuery({
    queryKey: queryKeys.content.list(orgId, { sort: 'newest', expired: false }),
    queryFn: () => apiFetch<ContentView[]>('/api/content?sort=newest'),
    enabled: open,
  })
  const websitesQuery = useQuery({
    queryKey: queryKeys.websites.list(orgId, { sort: 'name' }),
    queryFn: () => apiFetch<WebsiteView[]>('/api/websites?sort=name'),
    enabled: open && tab === 'web',
  })

  const { uploads, addFiles } = useUpload({
    orgId,
    folderId: null,
    onComplete: (content) =>
      setSelected((prev) => new Map(prev).set(`content:${content.id}`, { kind: 'content', content })),
  })
  const activeUploads = uploads.filter((u) => u.status !== 'done' && u.status !== 'canceled')

  const toggle = (key: string, pick: LibraryPick) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, pick)
      return next
    })

  const content = (contentQuery.data ?? []).filter((c) => !c.expired)
  const websites = websitesQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Add to this menu</DialogTitle>
          <DialogDescription className="text-[15px]">Tap everything you want to add, then press the button at the bottom.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-lg border border-border bg-card p-1">
            {(['media', 'web'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'media' ? 'Photos & videos' : 'Web pages'}
              </button>
            ))}
          </div>
          {tab === 'media' ? (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon /> Upload new
            </Button>
          ) : null}
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
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {activeUploads.length > 0 ? (
            <div className="mb-3 flex flex-col gap-2">
              {activeUploads.map((u) => (
                <div key={u.id} className="rounded-lg border border-border p-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{u.name}</span>
                    <span className="text-muted-foreground">{u.status === 'error' ? 'Failed' : `${u.progress}%`}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${u.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'media' ? (
            contentQuery.isPending ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : content.length === 0 ? (
              <p className="py-8 text-center text-[15px] text-muted-foreground">No photos or videos yet. Use Upload new.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {content.map((c) => {
                  const key = `content:${c.id}`
                  const on = selected.has(key)
                  const Fallback = c.type === 'video' ? FilmIcon : ImageIcon
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(key, { kind: 'content', content: c })}
                      className={cn(
                        'relative flex flex-col gap-1.5 rounded-xl border-2 p-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60',
                      )}
                    >
                      <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                        {c.thumb_url ? (
                          <img src={c.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Fallback className="size-6" />
                          </div>
                        )}
                      </div>
                      <div className="truncate px-0.5 text-sm font-semibold">{c.name}</div>
                      <div className="px-0.5 text-xs text-muted-foreground">
                        {c.type === 'video' ? `Video · ${formatDuration(c.duration_seconds) || '?'}` : 'Photo'}
                      </div>
                      <span
                        className={cn(
                          'absolute top-3 right-3 flex size-7 items-center justify-center rounded-full border-2 border-white shadow',
                          on ? 'bg-primary text-white' : 'bg-black/40',
                        )}
                      >
                        {on ? <CheckIcon className="size-4" /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          ) : websitesQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : websites.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-muted-foreground">No web pages yet. Add one from a TV page (Show a web page).</p>
          ) : (
            <div className="flex flex-col gap-2">
              {websites.map((w) => {
                const key = `website:${w.id}`
                const on = selected.has(key)
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(key, { kind: 'website', website: w })}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60',
                    )}
                  >
                    <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg">
                      <WebsiteThumb url={w.url} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold">{w.name}</div>
                      <div className="truncate text-sm text-muted-foreground">{w.url}</div>
                    </div>
                    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary bg-primary text-white' : 'border-border')}>
                      {on ? <CheckIcon className="size-4" /> : <GlobeIcon className="size-3.5 text-muted-foreground" />}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="lg" type="button" />}>Cancel</DialogClose>
          <Button
            size="lg"
            disabled={selected.size === 0}
            onClick={() => {
              onAdd(Array.from(selected.values()))
              onOpenChange(false)
            }}
          >
            Add {selected.size > 0 ? selected.size : ''} to menu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

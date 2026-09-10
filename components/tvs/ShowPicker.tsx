'use client'

/**
 * components/tvs/ShowPicker.tsx — "Show a menu / a photo or video / a web page" on one TV
 * (docs/CONTRACTS.md §23). One list of big radio rows and one button. The photo picker can
 * upload a new file right here (it is selected when the upload finishes); the web-page picker
 * can add a new page (name + https URL). Saving unlocks + assigns via useAssignScreen.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, FilmIcon, GlobeIcon, ImageIcon, ListIcon, PlusIcon, UploadIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { WebsiteThumb } from '@/components/playlist/WebsiteThumb'
import { useAssignScreen } from '@/components/tvs/useAssignScreen'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/hooks/useApp'
import { useUpload } from '@/hooks/useUpload'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn, formatDuration } from '@/lib/utils'
import type { AssignScreenInput } from '@/lib/validators/screens'
import { ACCEPTED_MIMES, type ContentView, type MenuView, type ScreenView, type WebsiteView } from '@/types/api'

export type ShowKind = 'menu' | 'content' | 'website'

const TITLES: Record<ShowKind, string> = {
  menu: 'Which menu?',
  content: 'Which photo or video?',
  website: 'Which web page?',
}
const HINTS: Record<ShowKind, string> = {
  menu: 'A menu plays its photos and videos one after another, over and over.',
  content: 'The TV shows this one photo (or plays this one video on repeat).',
  website: 'The TV shows the page full screen and reloads it now and then.',
}

type Option = { id: string; name: string; sub: string; thumb: string | null; website: string | null; kind: 'image' | 'video' | 'menu' | 'website' }

function PickRow({ option, selected, onSelect }: { option: Option; selected: boolean; onSelect(): void }) {
  const Fallback = option.kind === 'video' ? FilmIcon : option.kind === 'menu' ? ListIcon : option.kind === 'website' ? GlobeIcon : ImageIcon
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-2 p-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60',
      )}
    >
      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {option.website ? (
          <WebsiteThumb url={option.website} />
        ) : option.thumb ? (
          <img src={option.thumb} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Fallback className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold">{option.name}</div>
        <div className="truncate text-sm text-muted-foreground">{option.sub}</div>
      </div>
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-primary bg-primary text-white' : 'border-border',
        )}
      >
        {selected ? <CheckIcon className="size-4" /> : null}
      </span>
    </button>
  )
}

export function ShowPicker({
  screen,
  kind,
  onOpenChange,
}: {
  screen: ScreenView | null
  kind: ShowKind | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const orgId = org?.id ?? ''
  const queryClient = useQueryClient()
  const open = screen !== null && kind !== null
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingSite, setAddingSite] = useState(false)
  const [siteName, setSiteName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSelectedId(null)
      setAddingSite(false)
      setSiteName('')
      setSiteUrl('')
    }
  }, [open, kind, screen?.id])

  const menusQuery = useQuery({
    queryKey: queryKeys.menus.list(orgId),
    queryFn: () => apiFetch<MenuView[]>('/api/menus'),
    enabled: open && kind === 'menu',
  })
  const contentQuery = useQuery({
    queryKey: queryKeys.content.list(orgId, { sort: 'newest', expired: false }),
    queryFn: () => apiFetch<ContentView[]>('/api/content?sort=newest'),
    enabled: open && kind === 'content',
  })
  const websitesQuery = useQuery({
    queryKey: queryKeys.websites.list(orgId, { sort: 'name' }),
    queryFn: () => apiFetch<WebsiteView[]>('/api/websites?sort=name'),
    enabled: open && kind === 'website',
  })

  const { uploads, addFiles } = useUpload({
    orgId,
    folderId: null,
    onComplete: (content) => setSelectedId(content.id),
  })
  const activeUploads = uploads.filter((u) => u.status !== 'done' && u.status !== 'canceled')

  const addSite = useMutation({
    mutationFn: () =>
      apiFetch<WebsiteView>('/api/websites', {
        method: 'POST',
        json: { name: siteName.trim(), url: siteUrl.trim(), refresh_seconds: 0 },
      }),
    onSuccess: (site) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.websites.all(orgId) })
      setSelectedId(site.id)
      setAddingSite(false)
      toast.success(`Added ${site.name}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const assign = useAssignScreen({ onDone: () => onOpenChange(false) })

  const options: Option[] =
    kind === 'menu'
      ? (menusQuery.data ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          sub: `${m.item_count} ${m.item_count === 1 ? 'photo or video' : 'photos & videos'}${m.screen_count > 0 ? ` · on ${m.screen_count} ${m.screen_count === 1 ? 'TV' : 'TVs'}` : ''}`,
          thumb: m.thumb_url,
          website: null,
          kind: 'menu',
        }))
      : kind === 'content'
        ? (contentQuery.data ?? []).filter((c) => !c.expired).map((c) => ({
            id: c.id,
            name: c.name,
            sub: c.type === 'video' ? `Video${c.duration_seconds ? ` · ${formatDuration(c.duration_seconds)}` : ''}` : 'Photo',
            thumb: c.thumb_url,
            website: null,
            kind: c.type,
          }))
        : (websitesQuery.data ?? []).map((w) => ({
            id: w.id,
            name: w.name,
            sub: w.url,
            thumb: null,
            website: w.url,
            kind: 'website',
          }))
  const loading = kind === 'menu' ? menusQuery.isPending : kind === 'content' ? contentQuery.isPending : websitesQuery.isPending
  const chosen = options.find((o) => o.id === selectedId) ?? null

  const save = () => {
    if (!screen || !kind || !chosen || assign.isPending) return
    const body: AssignScreenInput =
      kind === 'menu' ? { kind: 'menu', menu_id: chosen.id } : kind === 'content' ? { kind: 'content', content_id: chosen.id } : { kind: 'website', website_id: chosen.id }
    assign.mutate({ screen, body, label: chosen.name })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{kind ? TITLES[kind] : ''}</DialogTitle>
          <DialogDescription className="text-[15px]">{kind ? HINTS[kind] : ''}</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 py-1" role="radiogroup">
          {kind === 'content' ? (
            <>
              <Button
                variant="outline"
                size="xl"
                className="border-2 border-dashed border-primary/60 text-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon /> Upload a new photo or video
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIMES.join(',')}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) addFiles(files.slice(0, 1))
                  e.target.value = ''
                }}
              />
              {activeUploads.map((u) => (
                <div key={u.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{u.name}</span>
                    <span className="text-muted-foreground">{u.status === 'error' ? 'Failed' : `${u.progress}%`}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${u.progress}%` }} />
                  </div>
                </div>
              ))}
            </>
          ) : null}

          {kind === 'website' ? (
            addingSite ? (
              <form
                className="flex flex-col gap-3 rounded-xl border-2 border-primary/40 p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (siteName.trim() && siteUrl.trim() && !addSite.isPending) addSite.mutate()
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="site-name">What should we call it?</Label>
                  <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Our Instagram" autoFocus className="h-11 text-base" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="site-url">Web address (starts with https://)</Label>
                  <Input id="site-url" type="url" inputMode="url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" className="h-11 text-base" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={addSite.isPending || !siteName.trim() || !siteUrl.trim()}>
                    {addSite.isPending ? 'Adding…' : 'Add this page'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setAddingSite(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="xl" className="border-2 border-dashed border-primary/60 text-primary" onClick={() => setAddingSite(true)}>
                <PlusIcon /> Add a new web page
              </Button>
            )
          ) : null}

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : options.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-muted-foreground">
              {kind === 'menu'
                ? 'You have no menus yet. Make one on the Menus page.'
                : kind === 'content'
                  ? 'No photos or videos yet. Upload one above.'
                  : 'No web pages yet. Add one above.'}
            </p>
          ) : (
            options.map((o) => <PickRow key={o.id} option={o} selected={o.id === selectedId} onSelect={() => setSelectedId(o.id)} />)
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="lg" type="button" />}>Cancel</DialogClose>
          <Button size="lg" disabled={!chosen || assign.isPending} onClick={save}>
            {assign.isPending ? 'Sending to the TV…' : screen ? `Show on ${screen.name}` : 'Show'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

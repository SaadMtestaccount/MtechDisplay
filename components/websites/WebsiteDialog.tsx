'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { WebsiteInput } from '@/lib/validators/websites'
import { REFRESH_OPTIONS, type RefreshSeconds, type WebsiteView } from '@/types/api'

const REFRESH_LABELS: Record<RefreshSeconds, string> = {
  0: 'Never',
  60: '1 minute',
  300: '5 minutes',
  900: '15 minutes',
  3600: '1 hour',
}

const REFRESH_ITEMS = REFRESH_OPTIONS.map((option) => ({ value: String(option), label: REFRESH_LABELS[option] }))

function parseRefresh(value: string): RefreshSeconds {
  return REFRESH_OPTIONS.find((option) => String(option) === value) ?? 0
}

/** Browser-side check only — the server re-validates with `websiteInputSchema`. */
function validateUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' ? null : 'The URL must start with https://'
  } catch {
    return 'Enter a valid URL, e.g. https://example.com'
  }
}

/** Add (no `website`) or edit (`website` set) a website (docs/CONTRACTS.md §9.3). */
export function WebsiteDialog({
  open,
  onOpenChange,
  website,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  website?: WebsiteView
}) {
  const isEdit = website !== undefined
  const { org } = useApp()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [refresh, setRefresh] = useState<RefreshSeconds>(0)
  const [urlError, setUrlError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(website?.name ?? '')
      setUrl(website?.url ?? '')
      setRefresh(parseRefresh(String(website?.refresh_seconds ?? 0)))
      setUrlError(null)
    }
  }, [open, website])

  const mutation = useMutation({
    mutationFn: (input: WebsiteInput) =>
      isEdit
        ? apiFetch<WebsiteView>(`/api/websites/${website.id}`, { method: 'PATCH', json: input })
        : apiFetch<WebsiteView>('/api/websites', { method: 'POST', json: input }),
    onSuccess: () => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.websites.all(org.id) })
      toast.success(isEdit ? 'Website updated' : 'Website added')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (mutation.isPending) return
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmedName || !trimmedUrl) return
    const error = validateUrl(trimmedUrl)
    if (error) {
      setUrlError(error)
      return
    }
    mutation.mutate({ name: trimmedName, url: trimmedUrl, refresh_seconds: refresh })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit website' : 'Add website'}</DialogTitle>
          {!isEdit ? (
            <DialogDescription>The page is shown full screen on your TVs, just like an image or video.</DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="website-name">Name</Label>
            <Input
              id="website-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weather board"
              maxLength={120}
              autoFocus
              disabled={mutation.isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="website-url">URL</Label>
            <Input
              id="website-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setUrlError(null)
              }}
              placeholder="https://example.com"
              maxLength={2048}
              aria-invalid={urlError !== null || undefined}
              disabled={mutation.isPending}
            />
            {urlError ? <p className="text-xs text-destructive">{urlError}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="website-refresh">Refresh interval</Label>
            <Select
              items={REFRESH_ITEMS}
              value={String(refresh)}
              onValueChange={(v) => setRefresh(parseRefresh(String(v)))}
            >
              <SelectTrigger id="website-refresh" className="w-full" disabled={mutation.isPending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">How often screens reload the page while it is showing.</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending || !name.trim() || !url.trim()}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add Website'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { LOGO_MIMES, MAX_LOGO_BYTES } from '@/types/api'
import type { Organization } from '@/types/db'

/**
 * Org logo upload (docs/CONTRACTS.md §9.1): client-side mime/size checks, then a raw
 * FormData POST — apiFetch sets no Content-Type, so the browser adds the multipart
 * boundary. The logo shows on the player standby screen (decision §0.3).
 */
export function LogoUpload({ org }: { org: Organization }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return apiFetch<Organization>(`/api/orgs/${org.id}/logo`, { method: 'POST', body: form })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success('Logo updated')
      router.refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!(LOGO_MIMES as readonly string[]).includes(file.type)) {
      toast.error('Logo must be a JPEG, PNG, WebP, GIF or SVG image')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be 5 MB or smaller')
      return
    }
    mutation.mutate(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>Shown on the player standby screen.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        {org.logo_url ? (
          <img
            src={org.logo_url}
            alt={`${org.name} logo`}
            className="size-16 shrink-0 rounded-lg border border-border bg-muted object-contain p-1.5"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <ImageIcon />
          </div>
        )}
        <div className="flex flex-col items-start gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={LOGO_MIMES.join(',')}
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {mutation.isPending ? 'Uploading…' : org.logo_url ? 'Replace logo' : 'Upload logo'}
          </Button>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, GIF or SVG — up to 5 MB.</p>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { WebsiteView } from '@/types/api'

/**
 * Wide dialog with a sandboxed iframe (docs/CONTRACTS.md §9.3) — the same sandbox the player
 * uses, so a site that renders here renders on screens.
 */
export function WebsitePreviewModal({
  website,
  onClose,
}: {
  website: WebsiteView | null
  onClose(): void
}) {
  return (
    <Dialog
      open={website !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        {website ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{website.name}</DialogTitle>
              <DialogDescription className="truncate">{website.url}</DialogDescription>
            </DialogHeader>
            <iframe
              src={website.url}
              title={`Preview of ${website.name}`}
              sandbox="allow-scripts allow-same-origin"
              className="aspect-video w-full rounded-lg border border-border bg-white"
            />
            <p className="text-xs text-muted-foreground">
              A blank frame means this site blocks embedding (X-Frame-Options or CSP) and will not render on screens.
            </p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { ExternalLinkIcon, EyeIcon, GlobeIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Card } from '@/components/ui/card'
import type { WebsiteView } from '@/types/api'

export type WebsiteCardAction = 'edit' | 'preview' | 'open' | 'delete'

/**
 * Library card: generic browser-frame thumbnail (chrome bar + centered favicon), name, url,
 * kebab (docs/CONTRACTS.md §9.3). Clicking the card previews; the kebab stops propagation.
 */
export function WebsiteCard({
  website,
  onAction,
}: {
  website: WebsiteView
  onAction(action: WebsiteCardAction): void
}) {
  return (
    <Card
      size="sm"
      className="cursor-pointer gap-3 transition-shadow hover:ring-foreground/20"
      onClick={() => onAction('preview')}
    >
      <div className="px-3">
        <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
          <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2.5 py-2">
            <span aria-hidden className="size-2 rounded-full bg-muted-foreground/30" />
            <span aria-hidden className="size-2 rounded-full bg-muted-foreground/30" />
            <span aria-hidden className="size-2 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex aspect-video items-center justify-center">
            {website.favicon_url ? (
              <img src={website.favicon_url} alt="" loading="lazy" className="size-10 rounded" />
            ) : (
              <GlobeIcon className="size-10 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 px-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={website.name}>
            {website.name}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={website.url}>
            {website.url}
          </p>
        </div>
        <KebabMenu
          label={`Actions for ${website.name}`}
          items={[
            { label: 'Edit', icon: <PencilIcon />, onSelect: () => onAction('edit') },
            { label: 'Preview', icon: <EyeIcon />, onSelect: () => onAction('preview') },
            { label: 'Open in new tab', icon: <ExternalLinkIcon />, onSelect: () => onAction('open') },
            {
              label: 'Delete',
              icon: <Trash2Icon />,
              onSelect: () => onAction('delete'),
              destructive: true,
              separatorBefore: true,
            },
          ]}
        />
      </div>
    </Card>
  )
}

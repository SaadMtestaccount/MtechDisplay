'use client'

import { CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { UploadItem } from '@/hooks/useUpload'
import { formatBytes } from '@/lib/utils'

const STATUS_LABEL: Record<UploadItem['status'], string> = {
  queued: 'Waiting…',
  preparing: 'Preparing…',
  uploading: 'Uploading…',
  finalizing: 'Finalizing…',
  done: 'Done',
  error: 'Failed',
  canceled: 'Canceled',
}

function isFinished(status: UploadItem['status']): boolean {
  return status === 'done' || status === 'error' || status === 'canceled'
}

/** Bottom-right upload panel: per-file progress, cancel, clear finished (docs/CONTRACTS.md §9.2). */
export function UploadProgress({
  uploads,
  onCancel,
  onClear,
}: {
  uploads: UploadItem[]
  onCancel(id: string): void
  onClear(): void
}) {
  if (uploads.length === 0) return null
  const finished = uploads.filter((u) => isFinished(u.status)).length

  return (
    <Card size="sm" className="fixed right-4 bottom-4 z-40 w-80 gap-0 shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 pb-2">
        <p className="text-sm font-semibold">
          Uploads
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {finished}/{uploads.length}
          </span>
        </p>
        {finished > 0 ? (
          <Button variant="ghost" size="xs" onClick={onClear}>
            Clear finished
          </Button>
        ) : null}
      </div>
      <ul className="flex max-h-64 flex-col overflow-y-auto">
        {uploads.map((item) => (
          <li key={item.id} className="flex flex-col gap-1.5 border-b border-border px-3 py-2 last:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-medium" title={item.name}>
                {item.name}
              </p>
              {item.status === 'done' ? (
                <CheckIcon className="size-3.5 shrink-0 text-online" />
              ) : isFinished(item.status) ? null : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Cancel ${item.name}`}
                  onClick={() => onCancel(item.id)}
                >
                  <XIcon />
                </Button>
              )}
            </div>
            {item.status === 'uploading' ? <Progress value={item.progress} /> : null}
            <p
              className={
                item.status === 'error'
                  ? 'text-[11px] text-destructive'
                  : 'text-[11px] text-muted-foreground'
              }
            >
              {item.status === 'error' && item.error ? item.error : STATUS_LABEL[item.status]}
              {item.status === 'uploading' ? ` ${item.progress}%` : ''} · {formatBytes(item.size)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

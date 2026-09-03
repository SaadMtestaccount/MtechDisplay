'use client'

/**
 * hooks/useUpload.ts — upload queue + state (docs/CONTRACTS.md §8, "useUpload" row).
 * Queue only: the per-file pipeline (sign → meta/thumb → XHR/TUS → thumb → POST /api/content)
 * lives in lib/upload-client.ts. Max 3 concurrent; `cancel(id)` aborts the transfer.
 * `UploadItem` is defined here and only here (UploadProgress imports it).
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { UploadCanceledError, startFileUpload, uploadRejectReason, type UploadHandle } from '@/lib/upload-client'
import type { ContentView } from '@/types/api'

export type UploadStatus = 'queued' | 'preparing' | 'uploading' | 'finalizing' | 'done' | 'error' | 'canceled'

export type UploadItem = {
  id: string
  file: File
  name: string
  size: number
  /** 0–100, media bytes only */
  progress: number
  status: UploadStatus
  error?: string
  content_id?: string
}

const MAX_CONCURRENT = 3
const TERMINAL: ReadonlySet<UploadStatus> = new Set(['done', 'error', 'canceled'])

export function useUpload({
  orgId,
  folderId,
  onComplete,
}: {
  orgId: string
  /** Folder new rows land in — captured per file at add time. */
  folderId: string | null
  onComplete?(content: ContentView): void
}): { uploads: UploadItem[]; addFiles(files: File[]): void; cancel(id: string): void; clearFinished(): void } {
  const queryClient = useQueryClient()
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const startedRef = useRef(new Set<string>())
  const handlesRef = useRef(new Map<string, UploadHandle>())
  const folderByIdRef = useRef(new Map<string, string | null>())
  const folderIdRef = useRef(folderId)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    folderIdRef.current = folderId
  }, [folderId])
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [])

  const start = useCallback(
    (item: UploadItem) => {
      const handle = startFileUpload(item.file, folderByIdRef.current.get(item.id) ?? null, {
        onPhase: (phase) => update(item.id, { status: phase }),
        onProgress: (percent) => update(item.id, { progress: percent }),
      })
      handlesRef.current.set(item.id, handle)
      handle.promise
        .then((content) => {
          update(item.id, { status: 'done', progress: 100, content_id: content.id })
          void queryClient.invalidateQueries({ queryKey: queryKeys.content.all(orgId) })
          void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all(orgId) })
          toast.success(`Uploaded ${content.name}`)
          onCompleteRef.current?.(content)
        })
        .catch((e: unknown) => {
          if (e instanceof UploadCanceledError) {
            update(item.id, { status: 'canceled' })
          } else {
            const message = e instanceof Error ? e.message : 'Upload failed'
            update(item.id, { status: 'error', error: message })
            toast.error(`${item.name}: ${message}`)
          }
        })
        .finally(() => {
          handlesRef.current.delete(item.id)
        })
    },
    [orgId, queryClient, update],
  )

  // Scheduler: keep at most MAX_CONCURRENT non-terminal started items running.
  useEffect(() => {
    const active = uploads.filter((u) => startedRef.current.has(u.id) && !TERMINAL.has(u.status)).length
    let slots = MAX_CONCURRENT - active
    for (const u of uploads) {
      if (slots <= 0) break
      if (u.status !== 'queued' || startedRef.current.has(u.id)) continue
      startedRef.current.add(u.id)
      slots -= 1
      start(u)
    }
  }, [uploads, start])

  const addFiles = useCallback(
    (files: File[]) => {
      if (!orgId) {
        toast.error('No active organization')
        return
      }
      const accepted: UploadItem[] = []
      for (const file of files) {
        const reason = uploadRejectReason(file)
        if (reason !== null) {
          toast.error(`${file.name}: ${reason}`)
          continue
        }
        const id = crypto.randomUUID()
        folderByIdRef.current.set(id, folderIdRef.current)
        accepted.push({
          id,
          file,
          name: file.name.slice(0, 120),
          size: file.size,
          progress: 0,
          status: 'queued',
        })
      }
      if (accepted.length > 0) setUploads((prev) => [...prev, ...accepted])
    },
    [orgId],
  )

  const cancel = useCallback(
    (id: string) => {
      const handle = handlesRef.current.get(id)
      if (handle) handle.cancel()
      else setUploads((prev) => prev.map((u) => (u.id === id && u.status === 'queued' ? { ...u, status: 'canceled' } : u)))
    },
    [],
  )

  const clearFinished = useCallback(() => {
    setUploads((prev) => {
      const gone = prev.filter((u) => TERMINAL.has(u.status))
      for (const u of gone) {
        startedRef.current.delete(u.id)
        folderByIdRef.current.delete(u.id)
      }
      return prev.filter((u) => !TERMINAL.has(u.status))
    })
  }, [])

  return { uploads, addFiles, cancel, clearFinished }
}

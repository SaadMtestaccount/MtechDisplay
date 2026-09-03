/**
 * lib/upload-client.ts — BROWSER ONLY per-file upload pipeline consumed by hooks/useUpload.ts
 * (docs/CONTRACTS.md §8, "useUpload" row). For one file:
 *   sign (POST /api/uploads/sign) → extract meta + thumbnail (lib/thumbs, best effort) →
 *   upload media (≤ 6 MB: raw XHR PUT to the signed URL — NEVER uploadToSignedUrl, it has no
 *   progress and no abort; > 6 MB: tus-js-client against /storage/v1/upload/resumable) →
 *   upload thumb via the browser Supabase client → POST /api/content.
 * A retry re-signs (new content id) — the hook simply calls startFileUpload again.
 */
import { Upload as TusUpload } from 'tus-js-client'
import {
  ACCEPTED_MIMES, MAX_UPLOAD_BYTES, RESUMABLE_THRESHOLD_BYTES,
  type ContentView, type UploadSignResponse,
} from '@/types/api'
import { apiFetch } from '@/lib/api-client'
import { BUCKETS, contentTypeForMime } from '@/lib/storage'
import { createBrowserClient } from '@/lib/supabase/client'
import { captureVideoFrame, extractImageMeta, extractVideoMeta, makeImageThumb } from '@/lib/thumbs'
import { formatBytes } from '@/lib/utils'
import type { ContentType } from '@/types/db'

export class UploadCanceledError extends Error {
  constructor() {
    super('Upload canceled')
    this.name = 'UploadCanceledError'
  }
}

/** Mime/size validation the hook runs before queueing; returns the reason or null when ok. */
export function uploadRejectReason(file: File): string | null {
  if (!(ACCEPTED_MIMES as readonly string[]).includes(file.type)) {
    return 'Unsupported file type (use JPG, PNG, WebP, GIF, MP4, WebM or MOV)'
  }
  if (file.size === 0) return 'File is empty'
  if (file.size > MAX_UPLOAD_BYTES) return `File is larger than ${formatBytes(MAX_UPLOAD_BYTES)}`
  return null
}

export type UploadPhase = 'preparing' | 'uploading' | 'finalizing'
export type UploadHandlers = {
  onPhase(phase: UploadPhase): void
  /** 0–100, media bytes only */
  onProgress(percent: number): void
}
export type UploadHandle = { promise: Promise<ContentView>; cancel(): void }

class UploadController {
  canceled = false
  private aborter: (() => void) | null = null
  cancel(): void {
    this.canceled = true
    const abort = this.aborter
    this.aborter = null
    abort?.()
  }
  setAborter(fn: (() => void) | null): void {
    this.aborter = fn
  }
  throwIfCanceled(): void {
    if (this.canceled) throw new UploadCanceledError()
  }
}

type MediaMeta = {
  width: number | null
  height: number | null
  duration_seconds: number | null
  thumb: Blob | null
}

/** Best effort — a file the browser cannot decode still uploads, just without meta/thumb. */
async function extractMeta(file: File, type: ContentType): Promise<MediaMeta> {
  try {
    if (type === 'image') {
      const meta = await extractImageMeta(file)
      return { ...meta, duration_seconds: null, thumb: await makeImageThumb(file) }
    }
    const meta = await extractVideoMeta(file)
    return {
      width: meta.width > 0 ? meta.width : null,
      height: meta.height > 0 ? meta.height : null,
      duration_seconds: Number.isFinite(meta.duration_seconds) ? meta.duration_seconds : null,
      thumb: await captureVideoFrame(file),
    }
  } catch (e) {
    console.warn('[upload] meta/thumbnail extraction failed for', file.name, e)
    return { width: null, height: null, duration_seconds: null, thumb: null }
  }
}

/** ≤ 6 MB: raw XHR PUT to the signed URL (progress + abort). */
function xhrUpload(
  file: File,
  sign: UploadSignResponse,
  handlers: UploadHandlers,
  controller: UploadController,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (controller.canceled) {
      reject(new UploadCanceledError())
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sign.signed_url)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('content-type', file.type)
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) handlers.onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new UploadCanceledError())
    controller.setAborter(() => xhr.abort())
    xhr.send(file)
  }).finally(() => controller.setAborter(null))
}

/** > 6 MB: resumable TUS upload (authenticated with the admin session token). */
async function tusUpload(
  file: File,
  sign: UploadSignResponse,
  handlers: UploadHandlers,
  controller: UploadController,
): Promise<void> {
  const supabase = createBrowserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('You are signed out — sign in again to upload')
  controller.throwIfCanceled()

  await new Promise<void>((resolve, reject) => {
    const upload = new TusUpload(file, {
      endpoint: sign.upload_url,
      headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'true' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: BUCKETS.media,
        objectName: sign.storage_path,
        contentType: file.type,
        cacheControl: '3600',
      },
      onProgress: (sent, total) => {
        if (total > 0) handlers.onProgress(Math.round((sent / total) * 100))
      },
      onSuccess: () => resolve(),
      onError: (error) => reject(controller.canceled ? new UploadCanceledError() : error),
    })
    controller.setAborter(() => {
      upload.abort().catch(() => undefined)
      reject(new UploadCanceledError())
    })
    upload.start()
  }).finally(() => controller.setAborter(null))
}

async function runPipeline(
  file: File,
  folderId: string | null,
  handlers: UploadHandlers,
  controller: UploadController,
): Promise<ContentView> {
  handlers.onPhase('preparing')
  const name = file.name.slice(0, 120)
  const type = contentTypeForMime(file.type)
  if (type === null) throw new Error('Unsupported file type')

  const sign = await apiFetch<UploadSignResponse>('/api/uploads/sign', {
    method: 'POST',
    json: { name, mime: file.type, size_bytes: file.size },
  })
  controller.throwIfCanceled()

  const meta = await extractMeta(file, type)
  controller.throwIfCanceled()

  handlers.onPhase('uploading')
  if (file.size > RESUMABLE_THRESHOLD_BYTES) await tusUpload(file, sign, handlers, controller)
  else await xhrUpload(file, sign, handlers, controller)
  controller.throwIfCanceled()

  handlers.onPhase('finalizing')
  let thumbPath: string | null = null
  if (meta.thumb) {
    const { error } = await createBrowserClient()
      .storage.from(BUCKETS.thumbs)
      .upload(sign.thumb_path, meta.thumb, { contentType: 'image/jpeg', upsert: true })
    if (error) console.warn('[upload] thumbnail upload failed for', file.name, error.message)
    else thumbPath = sign.thumb_path
  }
  controller.throwIfCanceled()

  return apiFetch<ContentView>('/api/content', {
    method: 'POST',
    json: {
      id: sign.content_id,
      name,
      type,
      storage_path: sign.storage_path,
      thumb_path: thumbPath,
      mime: file.type,
      size_bytes: file.size,
      width: meta.width,
      height: meta.height,
      duration_seconds: meta.duration_seconds,
      folder_id: folderId,
    },
  })
}

/** Starts the pipeline for one (already validated) file. `cancel()` aborts the XHR/TUS transfer. */
export function startFileUpload(
  file: File,
  folderId: string | null,
  handlers: UploadHandlers,
): UploadHandle {
  const controller = new UploadController()
  return {
    promise: runPipeline(file, folderId, handlers, controller),
    cancel: () => controller.cancel(),
  }
}

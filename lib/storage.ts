/**
 * lib/storage.ts — bucket names, object-key helpers and public URLs (isomorphic), plus
 * signed-URL / removal helpers that take a service-role client (server callers only).
 * Imports nothing server-only so client code may use the path helpers.
 */
import { ACCEPTED_MIMES, LOGO_MIMES, type AcceptedMime } from '@/types/api'
import type { ContentType, DbClient } from '@/types/db'

export const BUCKETS = { media: 'media', thumbs: 'thumbs', logos: 'logos' } as const
export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]

export const DEVICE_SIGNED_URL_TTL_SECONDS = 86_400
export const ADMIN_SIGNED_URL_TTL_SECONDS = 3_600

export const MIME_EXTENSIONS: Record<AcceptedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

function isAcceptedMime(mime: string): mime is AcceptedMime {
  return (ACCEPTED_MIMES as readonly string[]).includes(mime)
}

export function contentTypeForMime(mime: string): ContentType | null {
  if (!isAcceptedMime(mime)) return null
  return mime.startsWith('video/') ? 'video' : 'image'
}

export function extensionForMime(mime: string): string | null {
  return isAcceptedMime(mime) ? MIME_EXTENSIONS[mime] : null
}

export function logoExtensionForMime(mime: string): string | null {
  if (!(LOGO_MIMES as readonly string[]).includes(mime)) return null
  if (mime === 'image/svg+xml') return 'svg'
  return extensionForMime(mime)
}

export function mediaPath(orgId: string, contentId: string, ext: string): string {
  return `${orgId}/${contentId}.${ext}`
}

export function thumbPath(orgId: string, contentId: string): string {
  return `${orgId}/${contentId}-thumb.jpg`
}

export function logoPath(orgId: string, ext: string): string {
  return `${orgId}/logo.${ext}`
}

function supabaseUrl(): string {
  // Strip a stray BOM / whitespace that can sneak into the env value (e.g. when set through a
  // shell pipe) — a leading U+FEFF makes `<img src>` an invalid URL and breaks every thumbnail.
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^﻿/, '').trim().replace(/\/+$/, '')
}

export function publicUrl(bucket: BucketName, key: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${bucket}/${key}`
}

export function publicThumbUrl(thumbPath: string | null | undefined): string | null {
  return thumbPath ? publicUrl(BUCKETS.thumbs, thumbPath) : null
}

export function resumableUploadUrl(): string {
  return `${supabaseUrl()}/storage/v1/upload/resumable`
}

/** 1 signed URL for a media object; `download` = filename → Content-Disposition attachment. */
export async function createMediaSignedUrl(
  admin: DbClient,
  key: string,
  ttlSeconds: number,
  download?: string,
): Promise<string> {
  const { data, error } = await admin.storage
    .from(BUCKETS.media)
    .createSignedUrl(key, ttlSeconds, download ? { download } : undefined)
  if (error || !data) throw new Error(`Could not sign media URL for ${key}: ${error?.message ?? 'unknown error'}`)
  return data.signedUrl
}

/** Batched signing; entries with an error or a null signedUrl are omitted (console.warn). */
export async function createMediaSignedUrls(
  admin: DbClient,
  keys: string[],
  ttlSeconds: number,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = Array.from(new Set(keys))
  if (unique.length === 0) return map
  const { data, error } = await admin.storage.from(BUCKETS.media).createSignedUrls(unique, ttlSeconds)
  if (error || !data) {
    console.warn('[storage] createSignedUrls failed', error?.message)
    return map
  }
  data.forEach((entry, index) => {
    const key = entry.path ?? unique[index]
    if (entry.error || !entry.signedUrl) {
      console.warn('[storage] could not sign', key, entry.error)
      return
    }
    map.set(key, entry.signedUrl)
  })
  return map
}

/** Best effort removal; never throws. */
export async function removeObjects(admin: DbClient, bucket: BucketName, keys: string[]): Promise<void> {
  const list = keys.filter((k) => k.length > 0)
  if (list.length === 0) return
  try {
    const { error } = await admin.storage.from(bucket).remove(list)
    if (error) console.error('[storage] remove failed', bucket, error.message)
  } catch (e) {
    console.error('[storage] remove threw', bucket, e)
  }
}

/** Lists and removes every object under `${orgId}/` in all three buckets (paged, batched, best effort). */
export async function removeOrgObjects(admin: DbClient, orgId: string): Promise<void> {
  const limit = 1000
  for (const bucket of Object.values(BUCKETS)) {
    const keys: string[] = []
    try {
      let offset = 0
      for (;;) {
        const { data, error } = await admin.storage.from(bucket).list(orgId, { limit, offset })
        if (error) {
          console.error('[storage] list failed', bucket, orgId, error.message)
          break
        }
        const page = data ?? []
        for (const entry of page) keys.push(`${orgId}/${entry.name}`)
        if (page.length < limit) break
        offset += limit
      }
    } catch (e) {
      console.error('[storage] list threw', bucket, orgId, e)
    }
    for (let i = 0; i < keys.length; i += 100) {
      await removeObjects(admin, bucket, keys.slice(i, i + 100))
    }
  }
}

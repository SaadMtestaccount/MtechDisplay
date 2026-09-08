/**
 * lib/uploads.ts — signs direct-to-storage uploads (docs/CONTRACTS.md §5.14). Server-only.
 * The browser uploads the object itself (lib/upload-client.ts) and then POSTs the metadata
 * to /api/content, which re-derives and verifies every path (lib/content/mutations.ts).
 */
import type { DbClient } from '@/types/db'
import { MAX_UPLOAD_BYTES, RESUMABLE_THRESHOLD_BYTES, type UploadSignResponse } from '@/types/api'
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { BUCKETS, extensionForMime, mediaPath, resumableUploadUrl, thumbPath } from '@/lib/storage'
import type { UploadSignInput } from '@/lib/validators/uploads'

/**
 * Mints a content id, derives the storage/thumb keys and returns signed upload URLs for BOTH
 * the media object and its thumbnail (`upsert: true` so a retried PUT does not 409). The
 * thumbnail is signed too so the upload works for every console user — store managers have no
 * storage policy on the thumbs bucket, and a policy-rejected thumb used to leave the card with
 * a placeholder icon (§16). `resumable` tells the client to use TUS (> 6 MB) for the media.
 */
export async function signUpload(
  ctx: OrgContext,
  admin: DbClient,
  input: UploadSignInput,
): Promise<UploadSignResponse> {
  const ext = extensionForMime(input.mime)
  if (ext === null) throw new ApiError(422, 'Unsupported file type')
  if (input.size_bytes > MAX_UPLOAD_BYTES) throw new ApiError(413, 'File is too large (max 500 MB)')

  const contentId = crypto.randomUUID()
  const storagePath = mediaPath(ctx.org.id, contentId, ext)
  const thumbKey = thumbPath(ctx.org.id, contentId)

  const [media, thumb] = await Promise.all([
    admin.storage.from(BUCKETS.media).createSignedUploadUrl(storagePath, { upsert: true }),
    admin.storage.from(BUCKETS.thumbs).createSignedUploadUrl(thumbKey, { upsert: true }),
  ])
  if (media.error || !media.data) {
    throw new ApiError(500, `Could not create an upload URL: ${media.error?.message ?? 'unknown error'}`)
  }
  if (thumb.error || !thumb.data) {
    throw new ApiError(500, `Could not create a thumbnail upload URL: ${thumb.error?.message ?? 'unknown error'}`)
  }

  return {
    content_id: contentId,
    bucket: 'media',
    storage_path: storagePath,
    thumb_path: thumbKey,
    signed_url: media.data.signedUrl,
    token: media.data.token,
    thumb_signed_url: thumb.data.signedUrl,
    thumb_token: thumb.data.token,
    resumable: input.size_bytes > RESUMABLE_THRESHOLD_BYTES,
    upload_url: resumableUploadUrl(),
  }
}

/**
 * scripts/seed/storage.ts — bucket bootstrap and idempotent object uploads (service role).
 * Buckets normally come from supabase/migrations/0005_storage.sql; this only fills gaps.
 */
import type { DbClient } from '../../types/db'

type BucketSpec = { name: string; isPublic: boolean; limit: number; mimes: string[] }

const BUCKETS: BucketSpec[] = [
  {
    name: 'media',
    isPublic: false,
    limit: 524_288_000,
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'],
  },
  { name: 'thumbs', isPublic: true, limit: 10_485_760, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  { name: 'logos', isPublic: true, limit: 5_242_880, mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'] },
]

function isAlreadyExists(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('already exists') || m.includes('duplicate')
}

/** Create any missing bucket; "already exists" is not an error. Returns the names created. */
export async function ensureBuckets(admin: DbClient): Promise<string[]> {
  // List first: createBucket validates fileSizeLimit against the project's global upload
  // cap before checking existence, so re-creating a migration-made bucket whose limit
  // exceeds the cap (media on free tier) errors instead of reporting "already exists".
  const { data: existing, error: listError } = await admin.storage.listBuckets()
  if (listError) throw new Error(`listBuckets: ${listError.message}`)
  const have = new Set((existing ?? []).map((b) => b.name))
  const created: string[] = []
  for (const bucket of BUCKETS) {
    if (have.has(bucket.name)) continue
    const { error } = await admin.storage.createBucket(bucket.name, {
      public: bucket.isPublic,
      fileSizeLimit: bucket.limit,
      allowedMimeTypes: bucket.mimes,
    })
    if (!error) {
      created.push(bucket.name)
      continue
    }
    if (!isAlreadyExists(error.message)) throw new Error(`createBucket(${bucket.name}): ${error.message}`)
  }
  return created
}

/** Upload (overwrite) one object. Keys are bucket-relative, e.g. `{org_id}/{content_id}.png`. */
export async function uploadObject(
  admin: DbClient,
  bucket: string,
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await admin.storage.from(bucket).upload(key, bytes, { upsert: true, contentType })
  if (error) throw new Error(`upload ${bucket}/${key}: ${error.message}`)
}

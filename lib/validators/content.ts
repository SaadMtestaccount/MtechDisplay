/**
 * lib/validators/content.ts — /api/content schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import { ACCEPTED_MIMES, CONTENT_SORTS, MAX_UPLOAD_BYTES, type ContentListQuery } from '@/types/api'
import {
  flagSchema, hasAtLeastOneKey, nameSchema, optionalUuidOr, searchSchema, sortDirSchema, uuidSchema,
} from '@/lib/validators/common'

export const contentTypeSchema = z.enum(['image', 'video'] as const)

export const contentListQuerySchema = z.object({
  q: searchSchema,
  sort: z.enum(CONTENT_SORTS).default('newest'),
  dir: sortDirSchema.optional(),
  type: contentTypeSchema.optional(),
  /** uuid = that folder; 'root' = unfiled only; omitted = whole org */
  folder_id: optionalUuidOr('root'),
  expired: flagSchema,
}) satisfies z.ZodType<ContentListQuery>

const pathSchema = z.string().trim().min(1).max(500)

/** POST /api/content — metadata for an object already uploaded to storage. */
export const contentCreateSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  type: contentTypeSchema,
  storage_path: pathSchema,
  thumb_path: pathSchema.nullable(),
  mime: z.enum(ACCEPTED_MIMES),
  size_bytes: z.number().int().min(0).max(MAX_UPLOAD_BYTES),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  duration_seconds: z.number().nonnegative().finite().nullable(),
  folder_id: uuidSchema.nullable().default(null),
})
export type ContentCreateInput = z.infer<typeof contentCreateSchema>

/** PATCH /api/content/[id] — rename / move / set expiration (at least one key). */
export const contentUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    folder_id: uuidSchema.nullable().optional(),
    expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .refine(hasAtLeastOneKey, { message: 'Nothing to update' })
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>

/** GET /api/content/[id]/url?download=1 */
export const contentUrlQuerySchema = z.object({ download: flagSchema })
export type ContentUrlQuery = z.infer<typeof contentUrlQuerySchema>

/**
 * lib/validators/uploads.ts — POST /api/uploads/sign (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import { ACCEPTED_MIMES, MAX_UPLOAD_BYTES } from '@/types/api'
import { nameSchema } from '@/lib/validators/common'

export const uploadSignSchema = z.object({
  name: nameSchema,
  mime: z.enum(ACCEPTED_MIMES),
  size_bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
})
export type UploadSignInput = z.infer<typeof uploadSignSchema>

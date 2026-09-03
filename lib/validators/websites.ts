/**
 * lib/validators/websites.ts — /api/websites schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import { REFRESH_OPTIONS, WEBSITE_SORTS, type WebsiteListQuery } from '@/types/api'
import { nameSchema, searchSchema, sortDirSchema } from '@/lib/validators/common'

export const websiteListQuerySchema = z.object({
  q: searchSchema,
  sort: z.enum(WEBSITE_SORTS).default('name'),
  dir: sortDirSchema.optional(),
}) satisfies z.ZodType<WebsiteListQuery>

/** Must be an absolute https URL (screens render it in an iframe). */
export const httpsUrlSchema = z
  .url({ protocol: /^https$/, error: 'Enter a valid https:// URL' })
  .trim()
  .max(2048)

export const websiteInputSchema = z.object({
  name: nameSchema,
  url: httpsUrlSchema,
  refresh_seconds: z.literal(REFRESH_OPTIONS).default(0),
})
export type WebsiteInput = z.infer<typeof websiteInputSchema>

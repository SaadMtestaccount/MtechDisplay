/**
 * lib/validators/groups.ts — /api/groups schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import { GROUP_SORTS, type GroupListQuery } from '@/types/api'
import { nameSchema, searchSchema, sortDirSchema, uuidSchema } from '@/lib/validators/common'

export const groupListQuerySchema = z.object({
  q: searchSchema,
  sort: z.enum(GROUP_SORTS).default('name'),
  dir: sortDirSchema.optional(),
}) satisfies z.ZodType<GroupListQuery>

export const groupInputSchema = z.object({ name: nameSchema })
export type GroupInput = z.infer<typeof groupInputSchema>

/** PUT /api/groups/[id]/screens — the full member set. */
export const groupScreensSchema = z.object({ screen_ids: z.array(uuidSchema).max(500) })
export type GroupScreensInput = z.infer<typeof groupScreensSchema>

/**
 * lib/validators/orgs.ts — /api/orgs schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import { hasAtLeastOneKey, nameSchema, timezoneSchema, uuidSchema } from '@/lib/validators/common'

export const orgCreateSchema = z.object({
  name: nameSchema,
  timezone: timezoneSchema.optional(),
})
export type OrgCreateInput = z.infer<typeof orgCreateSchema>

export const orgUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    timezone: timezoneSchema.optional(),
    logo_url: z.url().max(2048).nullable().optional(),
  })
  .refine(hasAtLeastOneKey, { message: 'Nothing to update' })
export type OrgUpdateInput = z.infer<typeof orgUpdateSchema>

/** POST /api/orgs/active */
export const activeOrgSchema = z.object({ org_id: uuidSchema })
export type ActiveOrgInput = z.infer<typeof activeOrgSchema>

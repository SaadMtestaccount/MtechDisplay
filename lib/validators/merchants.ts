/**
 * lib/validators/merchants.ts — /api/merchants schemas (CONTRACTS addendum §13).
 * Creating a merchant makes their login AND their first location in one step. More locations are
 * added from the merchant's account, optionally copying an existing location's content and menus.
 */
import { z } from 'zod'
import { nameSchema, uuidSchema } from '@/lib/validators/common'
import { emailSchema } from '@/lib/validators/users'
import { SUBSCRIPTION_TIERS } from '@/types/api'

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72)

/** POST /api/merchants — email + password + the name of their first location + access level. */
export const createMerchantSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  location_name: nameSchema,
  role: z.enum(['member', 'admin']).default('member'),
})
export type CreateMerchantInput = z.infer<typeof createMerchantSchema>

/** POST /api/merchants/[id]/locations — add a location to an existing merchant. */
export const addLocationSchema = z.object({
  location_name: nameSchema,
  /** copy all content + menus from one of the merchant's existing locations */
  copy_from_org_id: uuidSchema.optional(),
})
export type AddLocationInput = z.infer<typeof addLocationSchema>

/** POST /api/merchants/[id]/password — set a new password. */
export const setMerchantPasswordSchema = z.object({ password: passwordSchema })
export type SetMerchantPasswordInput = z.infer<typeof setMerchantPasswordSchema>

/** POST /api/merchants/[id]/subscription — set the (dummy) subscription tier. */
export const setSubscriptionSchema = z.object({ tier: z.enum(SUBSCRIPTION_TIERS) })
export type SetSubscriptionInput = z.infer<typeof setSubscriptionSchema>

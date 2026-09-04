/**
 * lib/validators/merchants.ts — /api/merchants schemas (CONTRACTS addendum §13).
 */
import { z } from 'zod'
import { uuidSchema } from '@/lib/validators/common'
import { emailSchema } from '@/lib/validators/users'

/**
 * POST /api/merchants — MTech types the credentials directly (no invite email).
 * role: 'member' = TV display only; 'admin' = store manager (can use the Wall for their org).
 */
export const createMerchantSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  org_id: uuidSchema,
  role: z.enum(['member', 'admin']).default('member'),
})
export type CreateMerchantInput = z.infer<typeof createMerchantSchema>

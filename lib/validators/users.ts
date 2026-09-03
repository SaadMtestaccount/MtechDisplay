/**
 * lib/validators/users.ts — /api/users schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email())

/** POST /api/users — invite MTech staff (created as super admin). */
export const inviteUserSchema = z.object({ email: emailSchema })
export type InviteUserInput = z.infer<typeof inviteUserSchema>

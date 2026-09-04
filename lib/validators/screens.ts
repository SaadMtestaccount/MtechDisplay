/**
 * lib/validators/screens.ts ★ — /api/screens schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import {
  PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, ROTATIONS, SCREEN_ACTIONS, SCREEN_SORTS, SCREEN_STATUSES,
  type ScreenListQuery,
} from '@/types/api'
import {
  hasAtLeastOneKey, nameSchema, optionalUuidOr, searchSchema, sortDirSchema, uuidSchema,
} from '@/lib/validators/common'

export const PAIRING_CODE_REGEX = new RegExp(`^[${PAIRING_CODE_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`)

/** Pairing code as typed by an admin or sent by a device: trimmed, upper-cased, 6 chars of the alphabet. */
export const pairingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PAIRING_CODE_REGEX, { message: `Enter the ${PAIRING_CODE_LENGTH}-character code shown on the TV` })

export const screenListQuerySchema = z.object({
  q: searchSchema,
  sort: z.enum(SCREEN_SORTS).default('name'),
  dir: sortDirSchema.optional(),
  status: z.enum(SCREEN_STATUSES).optional(),
  /** uuid = that group; 'none' = ungrouped only; omitted = all */
  group_id: optionalUuidOr('none'),
}) satisfies z.ZodType<ScreenListQuery>

/** POST /api/screens/claim */
export const claimScreenSchema = z.object({
  code: pairingCodeSchema,
  name: nameSchema,
})
export type ClaimScreenInput = z.infer<typeof claimScreenSchema>

/** PATCH /api/screens/[id] — rename / rotation / group / lock (at least one key). */
export const screenUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    rotation: z.literal(ROTATIONS).optional(),
    group_id: uuidSchema.nullable().optional(),
    locked: z.boolean().optional(),
  })
  .refine(hasAtLeastOneKey, { message: 'Nothing to update' })
export type ScreenUpdateInput = z.infer<typeof screenUpdateSchema>

/** POST /api/screens/[id]/assign — put a menu / board / web page on a screen, or clear it. */
export const assignScreenSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('menu'), menu_id: uuidSchema }),
  z.object({ kind: z.literal('content'), content_id: uuidSchema }),
  z.object({ kind: z.literal('website'), website_id: uuidSchema }),
  z.object({ kind: z.literal('clear') }),
])
export type AssignScreenInput = z.infer<typeof assignScreenSchema>

/** POST /api/screens/[id]/actions */
export const screenActionSchema = z.object({ action: z.enum(SCREEN_ACTIONS) })
export type ScreenActionInput = z.infer<typeof screenActionSchema>

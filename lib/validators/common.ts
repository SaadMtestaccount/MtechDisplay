/**
 * lib/validators/common.ts — zod v4 building blocks shared by every resource validator.
 * Isomorphic (no server imports).
 */
import { z } from 'zod'
import { SORT_DIRS } from '@/types/api'

export const uuidSchema = z.uuid()

/** Display names everywhere (content, folders, websites, screens, groups, orgs): 1..120 chars, trimmed. */
export const nameSchema = z.string().trim().min(1, 'Name is required').max(120, 'Name is too long')

/** `q` list-search parameter. */
export const searchSchema = z.string().trim().max(200).optional()

export const sortDirSchema = z.enum(SORT_DIRS)

/** Query-string boolean: '1' | 'true' (or a real `true`) → true; anything else / absent → false. */
export const flagSchema = z.preprocess(
  (value: unknown) => value === '1' || value === 'true' || value === true,
  z.boolean(),
)

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** IANA time zone name validated with `Intl.DateTimeFormat`. */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimezone, { message: 'Unknown time zone' })

/** Optional query value that is either a uuid or a fixed literal (e.g. `'root'`, `'none'`). */
export function optionalUuidOr<L extends string>(literal: L) {
  return z.union([z.uuid(), z.literal(literal)]).optional()
}

/** `.refine` helper for PATCH bodies: at least one own key is not undefined. */
export function hasAtLeastOneKey(value: Record<string, unknown>): boolean {
  return Object.values(value).some((v) => v !== undefined)
}

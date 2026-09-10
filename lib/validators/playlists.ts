/**
 * lib/validators/playlists.ts ★ — /api/playlists schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import type { PlaylistListQuery } from '@/types/api'
import { hasAtLeastOneKey, nameSchema, uuidSchema } from '@/lib/validators/common'

export const playlistKindSchema = z.enum(['screen', 'group', 'menu'] as const)
export const playlistItemTypeSchema = z.enum(['content', 'website'] as const)
export const transitionSchema = z.enum(['none', 'fade'] as const)

export const playlistListQuerySchema = z.object({
  kind: playlistKindSchema.optional(),
}) satisfies z.ZodType<PlaylistListQuery>

const isoDate = z.iso.date()
const isoTime = z.iso.time()

/** One row of the full ordered list sent by the editor; `position` is the array index. */
export const playlistItemInputSchema = z
  .object({
    id: uuidSchema,
    item_type: playlistItemTypeSchema,
    content_id: uuidSchema.nullable(),
    website_id: uuidSchema.nullable(),
    duration_seconds: z.number().int().min(1).max(86_400).nullable(),
    transition: transitionSchema.default('fade'),
    mute: z.boolean().default(true),
    active_from: isoDate.nullable(),
    active_to: isoDate.nullable(),
    days_of_week: z.array(z.number().int().min(0).max(6)).max(7).nullable(),
    daily_start: isoTime.nullable(),
    daily_end: isoTime.nullable(),
  })
  .superRefine((item, ctx) => {
    if (item.item_type === 'content') {
      if (item.content_id === null) {
        ctx.addIssue({ code: 'custom', path: ['content_id'], message: 'Content items need a content_id' })
      }
      if (item.website_id !== null) {
        ctx.addIssue({ code: 'custom', path: ['website_id'], message: 'Content items cannot have a website_id' })
      }
    } else {
      if (item.website_id === null) {
        ctx.addIssue({ code: 'custom', path: ['website_id'], message: 'Website items need a website_id' })
      }
      if (item.content_id !== null) {
        ctx.addIssue({ code: 'custom', path: ['content_id'], message: 'Website items cannot have a content_id' })
      }
    }
    if (item.active_from !== null && item.active_to !== null && item.active_from > item.active_to) {
      ctx.addIssue({ code: 'custom', path: ['active_to'], message: 'End date must be on or after the start date' })
    }
  })
export type PlaylistItemInput = z.infer<typeof playlistItemInputSchema>

/** PATCH /api/playlists/[id] — rename and/or toggle synchronized playback (§21). */
export const playlistUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    sync: z.boolean().optional(),
  })
  .refine(hasAtLeastOneKey, { message: 'Nothing to update' })
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateSchema>

/** PUT /api/playlists/[id]/items — the full ordered list. */
export const savePlaylistItemsSchema = z.object({
  items: z.array(playlistItemInputSchema).max(500),
})
export type SavePlaylistItemsInput = z.infer<typeof savePlaylistItemsSchema>

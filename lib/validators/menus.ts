/**
 * lib/validators/menus.ts — /api/menus schemas. A Menu is a reusable kind='menu' playlist;
 * its boards are edited through the existing PUT /api/playlists/[id]/items.
 */
import { z } from 'zod'
import { nameSchema } from '@/lib/validators/common'

export const menuInputSchema = z.object({ name: nameSchema })
export type MenuInput = z.infer<typeof menuInputSchema>

/**
 * lib/validators/folders.ts — /api/folders schemas (docs/CONTRACTS.md §5.27).
 */
import { z } from 'zod'
import type { FolderListQuery } from '@/types/api'
import { nameSchema, searchSchema } from '@/lib/validators/common'

export const folderListQuerySchema = z.object({ q: searchSchema }) satisfies z.ZodType<FolderListQuery>

export const folderInputSchema = z.object({ name: nameSchema })
export type FolderInput = z.infer<typeof folderInputSchema>

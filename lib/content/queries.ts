/**
 * lib/content/queries.ts — content reads (docs/CONTRACTS.md §5.15). Server-only.
 */
import type { Content, DbClient } from '@/types/db'
import type { ContentListQuery, ContentView } from '@/types/api'
import { ApiError } from '@/lib/api'
import { ADMIN_SIGNED_URL_TTL_SECONDS, createMediaSignedUrl, publicThumbUrl } from '@/lib/storage'
import { escapeLike } from '@/lib/utils'

export const CONTENT_SELECT = '*, folders(name)' as const

export type ContentSource = Content & { folders?: { name: string } | null }

export function isContentExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime()
}

export function toContentView(row: ContentSource, now: Date = new Date()): ContentView {
  const { folders, ...content } = row
  return {
    ...content,
    thumb_url: publicThumbUrl(content.thumb_path),
    expired: isContentExpired(content.expires_at, now),
    folder_name: folders?.name ?? null,
  }
}

export async function listContent(supabase: DbClient, orgId: string, query: ContentListQuery): Promise<ContentView[]> {
  const now = new Date()
  let q = supabase.from('content').select(CONTENT_SELECT).eq('org_id', orgId)
  if (query.q) q = q.ilike('name', `%${escapeLike(query.q)}%`)
  if (query.type) q = q.eq('type', query.type)
  if (query.folder_id === 'root') q = q.is('folder_id', null)
  else if (query.folder_id) q = q.eq('folder_id', query.folder_id)
  if (query.expired) q = q.lte('expires_at', now.toISOString())

  const dir = query.dir
  const ordered = (() => {
    switch (query.sort) {
      case 'name':
        return q.order('name', { ascending: dir !== 'desc' })
      case 'oldest':
        return q.order('created_at', { ascending: dir !== 'desc' })
      case 'size':
        return q.order('size_bytes', { ascending: dir === 'asc' })
      case 'type':
        return q.order('type', { ascending: dir !== 'desc' }).order('name', { ascending: true })
      case 'newest':
      default:
        return q.order('created_at', { ascending: dir === 'asc' })
    }
  })()

  const { data, error } = await ordered
  if (error) throw error
  return data.map((row) => toContentView(row, now))
}

export async function getContentSource(supabase: DbClient, orgId: string, id: string): Promise<ContentSource> {
  const { data, error } = await supabase
    .from('content')
    .select(CONTENT_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Content not found')
  return data
}

export async function getContent(supabase: DbClient, orgId: string, id: string): Promise<ContentView> {
  return toContentView(await getContentSource(supabase, orgId, id))
}

export async function countExpired(supabase: DbClient, orgId: string, now: Date = new Date()): Promise<number> {
  const { count, error } = await supabase
    .from('content')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .lte('expires_at', now.toISOString())
  if (error) throw error
  return count ?? 0
}

/** 1h signed URL; `download` → `Content-Disposition: attachment` named after the content. */
export async function getContentUrl(admin: DbClient, content: Content, download = false): Promise<string> {
  return createMediaSignedUrl(
    admin,
    content.storage_path,
    ADMIN_SIGNED_URL_TTL_SECONDS,
    download ? content.name : undefined,
  )
}

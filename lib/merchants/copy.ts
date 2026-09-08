/**
 * lib/merchants/copy.ts — SERVER ONLY (service role). Copy a location's content (media +
 * thumbnails, via Storage copy) and menus (with their items remapped to the new content) into
 * another location. Best effort per item; a failed item is skipped so the rest still copies.
 */
import { randomUUID } from 'node:crypto'
import type { DbClient } from '@/types/db'

export async function copyLocationContent(admin: DbClient, fromOrg: string, toOrg: string): Promise<void> {
  const { data: content, error: contentError } = await admin.from('content').select('*').eq('org_id', fromOrg)
  if (contentError) throw contentError
  const contentMap = new Map<string, string>()
  for (const item of content ?? []) {
    const newId = randomUUID()
    const ext = item.storage_path.split('.').pop() ?? 'bin'
    const newMediaPath = `${toOrg}/${newId}.${ext}`
    const newThumbPath = item.thumb_path ? `${toOrg}/${newId}-thumb.jpg` : null

    const { error: mediaError } = await admin.storage.from('media').copy(item.storage_path, newMediaPath)
    if (mediaError) {
      console.warn('[copy] media', item.storage_path, mediaError.message)
      continue
    }
    if (item.thumb_path && newThumbPath) {
      const { error: thumbError } = await admin.storage.from('thumbs').copy(item.thumb_path, newThumbPath)
      if (thumbError) console.warn('[copy] thumb', item.thumb_path, thumbError.message)
    }
    const { error: insertError } = await admin.from('content').insert({
      id: newId,
      org_id: toOrg,
      folder_id: null,
      name: item.name,
      type: item.type,
      storage_path: newMediaPath,
      thumb_path: newThumbPath,
      mime: item.mime,
      size_bytes: item.size_bytes,
      width: item.width,
      height: item.height,
      duration_seconds: item.duration_seconds,
      expires_at: null,
      created_by: item.created_by,
    })
    if (insertError) {
      console.warn('[copy] content row', insertError.message)
      continue
    }
    contentMap.set(item.id, newId)
  }

  const { data: websites } = await admin.from('websites').select('*').eq('org_id', fromOrg)
  const websiteMap = new Map<string, string>()
  for (const site of websites ?? []) {
    const newId = randomUUID()
    const { error } = await admin
      .from('websites')
      .insert({ id: newId, org_id: toOrg, name: site.name, url: site.url, refresh_seconds: site.refresh_seconds })
    if (error) continue
    websiteMap.set(site.id, newId)
  }

  const { data: menus } = await admin.from('playlists').select('*').eq('org_id', fromOrg).eq('kind', 'menu')
  for (const menu of menus ?? []) {
    const { data: newMenu, error: menuError } = await admin
      .from('playlists')
      .insert({ org_id: toOrg, name: menu.name, kind: 'menu' })
      .select('id')
      .single()
    if (menuError || !newMenu) continue
    const { data: items } = await admin
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', menu.id)
      .order('position', { ascending: true })
    const rows = (items ?? [])
      .map((it) => {
        const contentId = it.content_id ? (contentMap.get(it.content_id) ?? null) : null
        const websiteId = it.website_id ? (websiteMap.get(it.website_id) ?? null) : null
        if (it.item_type === 'content' && !contentId) return null
        if (it.item_type === 'website' && !websiteId) return null
        return {
          id: randomUUID(),
          playlist_id: newMenu.id,
          position: it.position,
          item_type: it.item_type,
          content_id: contentId,
          website_id: websiteId,
          duration_seconds: it.duration_seconds,
          transition: it.transition,
          mute: it.mute,
          active_from: it.active_from,
          active_to: it.active_to,
          days_of_week: it.days_of_week,
          daily_start: it.daily_start,
          daily_end: it.daily_end,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    if (rows.length > 0) await admin.from('playlist_items').insert(rows)
  }
}

/**
 * components/wall/wall-dnd.ts — the drag payload for the Screen Wall and the helpers that turn a
 * dropped item into an /assign body. Draggable = tray card (`pick:{kind}:{id}`); droppable = TV tile
 * (`tile:{screenId}`).
 */
import { faviconUrl } from '@/lib/utils'
import type { AssignScreenInput } from '@/lib/validators/screens'
import type { ContentView, MenuView, WebsiteView } from '@/types/api'

export type WallPick =
  | { kind: 'menu'; id: string; name: string; thumbUrl: string | null; detail: string }
  | { kind: 'content'; id: string; name: string; thumbUrl: string | null; detail: string }
  | { kind: 'website'; id: string; name: string; url: string; detail: string }

export function menuPick(m: MenuView): WallPick {
  return {
    kind: 'menu',
    id: m.id,
    name: m.name,
    thumbUrl: m.thumb_url,
    detail: `${m.item_count} board${m.item_count === 1 ? '' : 's'}`,
  }
}

export function contentPick(c: ContentView): WallPick {
  return { kind: 'content', id: c.id, name: c.name, thumbUrl: c.thumb_url, detail: c.type === 'video' ? 'Video' : 'Image' }
}

export function websitePick(w: WebsiteView): WallPick {
  return { kind: 'website', id: w.id, name: w.name, url: w.url, detail: 'Web page' }
}

export function wallDragId(pick: WallPick): string {
  return `pick:${pick.kind}:${pick.id}`
}

export function tileDropId(screenId: string): string {
  return `tile:${screenId}`
}

export function screenIdFromDrop(overId: string | null): string | null {
  return overId && overId.startsWith('tile:') ? overId.slice('tile:'.length) : null
}

export function assignBodyFor(pick: WallPick): AssignScreenInput {
  switch (pick.kind) {
    case 'menu':
      return { kind: 'menu', menu_id: pick.id }
    case 'content':
      return { kind: 'content', content_id: pick.id }
    case 'website':
      return { kind: 'website', website_id: pick.id }
  }
}

export function pickThumbFavicon(url: string): string {
  return faviconUrl(url)
}

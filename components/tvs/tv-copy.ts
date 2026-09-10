/**
 * components/tvs/tv-copy.ts — plain-words descriptions of a TV for the merchant console
 * (docs/CONTRACTS.md §23). No React.
 */
import { screenStatus } from '@/lib/status'
import { formatLoginCode } from '@/lib/utils'
import type { ScreenView } from '@/types/api'

export type TvShowing =
  | { kind: 'menu'; name: string }
  | { kind: 'item'; name: string }
  | { kind: 'nothing' }

/** What the TV is set up to show (independent of whether it is on). */
export function tvShowing(screen: ScreenView): TvShowing {
  if (screen.menu_name) return { kind: 'menu', name: screen.menu_name }
  const item = screen.current_item?.name
  if (item) return { kind: 'item', name: item }
  if (screen.preview_thumb_url !== null || screen.preview_website_url !== null) return { kind: 'item', name: 'a photo, video or web page' }
  return { kind: 'nothing' }
}

/** One line under the TV name on cards. */
export function tvSubtitle(screen: ScreenView): string {
  const status = screenStatus(screen)
  if (status === 'unpaired') return `Not signed in yet · code ${formatLoginCode(screen.login_code)}`
  if (status === 'offline') return 'Check the TV is plugged in and on Wi-Fi.'
  const showing = tvShowing(screen)
  return showing.kind === 'nothing' ? 'Showing nothing yet' : `Showing ${showing.name}`
}

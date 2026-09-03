/**
 * lib/screens.ts — SERVER ONLY. Contracted surface (docs/CONTRACTS.md §5.19), implemented in
 * lib/screens/select.ts (select literal + view mapper), lib/screens/views.ts (reads) and
 * lib/screens/mutations.ts (writes).
 */
export { SCREEN_SELECT, toScreenView, type ScreenSource } from '@/lib/screens/select'
export { getScreenDetail, getScreenView, listScreens } from '@/lib/screens/views'
export {
  bumpAndSyncScreens,
  claimScreen,
  createScreenWithPlaylist,
  deleteScreen,
  sendScreenAction,
  syncOrgScreens,
  updateScreen,
} from '@/lib/screens/mutations'

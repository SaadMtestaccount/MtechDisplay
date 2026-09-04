/**
 * lib/screens.ts — SERVER ONLY. Contracted surface (docs/CONTRACTS.md §5.19), implemented in
 * lib/screens/select.ts (select literal + view mapper), lib/screens/views.ts (reads) and
 * lib/screens/mutations.ts (writes).
 */
export { SCREEN_SELECT, toScreenView, type ScreenSource } from '@/lib/screens/select'
export { assignScreen } from '@/lib/screens/assign'
export { enrollScreen } from '@/lib/screens/enroll'
export { getScreenDetail, getScreenView, listScreens } from '@/lib/screens/views'
export {
  bumpAndSyncScreens,
  claimScreen,
  createScreen,
  createScreenWithPlaylist,
  deleteScreen,
  regenerateScreenCode,
  sendScreenAction,
  syncOrgScreens,
  updateScreen,
} from '@/lib/screens/mutations'

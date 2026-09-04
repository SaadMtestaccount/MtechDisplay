/**
 * types/api.ts — shared request/response shapes for /api/*, realtime payloads and the
 * player. Server libs build these; client components consume them. Option lists are
 * exported as `as const` arrays so validators and UI share one definition: string lists feed
 * `z.enum(CONST)`, numeric lists (ROTATIONS, REFRESH_OPTIONS) feed `z.literal(CONST)` — zod v4
 * `z.enum` is string-only. Isomorphic: no server imports.
 */
import type { ZodIssue } from 'zod'
import type {
  Content, ContentType, Folder, MembershipRole, Organization, Playlist, PlaylistItem, PlaylistItemType,
  PlaylistKind, Profile, Screen, ScreenGroup, TransitionType, Website,
} from './db'

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------
export type ApiSuccess<T> = { data: T }
export type ApiFailure = { error: { message: string; issues?: ZodIssue[] } }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type OkResponse = { ok: true }
export type CountResponse = { count: number }
export type DeletedResponse = { deleted: number }
export type UrlResponse = { url: string }
export type ActiveOrgResponse = { org_id: string }

// ---------------------------------------------------------------------------
// Enumerations and limits shared by validators, UI and libs
// ---------------------------------------------------------------------------
export const SORT_DIRS = ['asc', 'desc'] as const
export type SortDir = (typeof SORT_DIRS)[number]

export const CONTENT_SORTS = ['name', 'newest', 'oldest', 'size', 'type'] as const
export type ContentSort = (typeof CONTENT_SORTS)[number]

export const SCREEN_SORTS = ['name', 'last_seen', 'newest'] as const
export type ScreenSort = (typeof SCREEN_SORTS)[number]

export const WEBSITE_SORTS = ['name', 'newest', 'oldest'] as const
export type WebsiteSort = (typeof WEBSITE_SORTS)[number]

export const GROUP_SORTS = ['name', 'newest'] as const
export type GroupSort = (typeof GROUP_SORTS)[number]

/** List filter values (an unpaired screen filters as 'offline'). */
export const SCREEN_STATUSES = ['online', 'offline'] as const
export type ScreenStatus = (typeof SCREEN_STATUSES)[number]

/** What the UI renders — `screenStatus(view)` in lib/status.ts; 'unpaired' = no device token yet. */
export const SCREEN_PRESENCE = ['online', 'offline', 'unpaired'] as const
export type ScreenPresence = (typeof SCREEN_PRESENCE)[number]

/** numeric — validate with `z.literal(ROTATIONS)` */
export const ROTATIONS = [0, 90, 180, 270] as const
export type Rotation = (typeof ROTATIONS)[number]

/** Website refresh interval options: Never / 1m / 5m / 15m / 1h (numeric — `z.literal(REFRESH_OPTIONS)`). */
export const REFRESH_OPTIONS = [0, 60, 300, 900, 3600] as const
export type RefreshSeconds = (typeof REFRESH_OPTIONS)[number]

export const SCREEN_ACTIONS = ['identify', 'reload'] as const
export type ScreenAction = (typeof SCREEN_ACTIONS)[number]

export const MEDIA_TYPES = ['image', 'video', 'website'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export const ACCEPTED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime',
] as const
export type AcceptedMime = (typeof ACCEPTED_MIMES)[number]

/** Org logo upload (bucket `logos` allows exactly these). */
export const LOGO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'] as const
export type LogoMime = (typeof LOGO_MIMES)[number]
export const MAX_LOGO_BYTES = 5 * 1024 * 1024

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024
export const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024
export const DEFAULT_ITEM_DURATION_SECONDS = 10

/** Pairing codes: unambiguous alphabet (no 0/O/1/I), 6 chars, 15 minutes. lib/pairing.ts re-exports these. */
export const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const PAIRING_CODE_LENGTH = 6
export const PAIRING_CODE_TTL_MS = 15 * 60_000

/**
 * Active-org cookie (super-admin org switcher). Lives here (isomorphic) so lib/orgs.ts (server-only,
 * imports next/headers) can re-export it without dragging next/headers into any client bundle.
 * Read only on the server (`getActiveOrg()`); set by POST /api/orgs/active.
 */
export const ACTIVE_ORG_COOKIE = 'msign_org'
export const ACTIVE_ORG_COOKIE_OPTIONS = { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 31536000 } as const

// ---------------------------------------------------------------------------
// List query shapes (validators in lib/validators/* must infer to these)
// ---------------------------------------------------------------------------
export type ContentListQuery = {
  q?: string
  sort: ContentSort
  dir?: SortDir
  type?: ContentType
  /** uuid = that folder; 'root' = unfiled only; omitted = whole org */
  folder_id?: string
  expired: boolean
}
export type FolderListQuery = { q?: string }
export type WebsiteListQuery = { q?: string; sort: WebsiteSort; dir?: SortDir }
export type ScreenListQuery = {
  q?: string
  sort: ScreenSort
  dir?: SortDir
  status?: ScreenStatus
  /** uuid = that group; 'none' = ungrouped only; omitted = all */
  group_id?: string
}
export type GroupListQuery = { q?: string; sort: GroupSort; dir?: SortDir }
export type PlaylistListQuery = { kind?: PlaylistKind }

// ---------------------------------------------------------------------------
// View shapes returned by list / detail endpoints
// ---------------------------------------------------------------------------
export type ContentView = Content & { thumb_url: string | null; expired: boolean; folder_name: string | null }
export type FolderView = Folder & { item_count: number }
export type WebsiteView = Website & { favicon_url: string }

export type CurrentItemView = {
  id: string
  name: string
  /** public thumb URL for content; always null for websites (render the browser-frame placeholder + faviconUrl(website_url)) */
  thumb_url: string | null
  item_type: PlaylistItemType
  media_type: MediaType
  /** websites.url for website items, null for content (mirror of PlaylistItemView.website_url) */
  website_url: string | null
}

export type ScreenView = Omit<Screen, 'device_token_hash'> & {
  /** device_token_hash !== null */
  paired: boolean
  online: boolean
  group_name: string | null
  /** name of the assigned menu (screens.menu_id), null when none is assigned */
  menu_name: string | null
  effective_playlist_id: string | null
  current_item: CurrentItemView | null
}

export type PlaylistItemView = PlaylistItem & {
  name: string
  media_type: MediaType
  /** public thumb URL for content; always null for websites */
  thumb_url: string | null
  /** detected video duration from content.duration_seconds; null for images/websites */
  source_duration_seconds: number | null
  website_url: string | null
  expired: boolean
}
export type PlaylistView = Playlist & { items: PlaylistItemView[] }

/** A reusable menu (kind='menu' playlist) as shown in the Menus library and the wall tray. */
export type MenuView = Playlist & {
  item_count: number
  screen_count: number
  /** cover thumb = first board's thumbnail; null when the first item is a web page or the menu is empty */
  thumb_url: string | null
}

export type ScreenDetailView = ScreenView & {
  /** the EFFECTIVE playlist (group playlist when grouped) */
  playlist: PlaylistView | null
  group: { id: string; name: string; playlist_id: string } | null
}

export type GroupView = ScreenGroup & { screen_count: number; online_count: number; offline_count: number }
/** `screens` = the group's members (group_id = id), ordered by name */
export type GroupDetailView = GroupView & { screens: ScreenView[]; playlist: PlaylistView }

export type OrganizationView = Organization & { screen_count: number; content_count: number }

export type UserView = {
  id: string
  email: string
  full_name: string | null
  last_sign_in_at: string | null
  created_at: string
  is_super_admin: boolean
}

/** Merchant / store login (non-staff user with an org membership). role 'member' = TV only, 'admin' = manager. */
export type MerchantView = {
  id: string
  email: string
  org_id: string
  org_name: string
  role: MembershipRole
  last_sign_in_at: string | null
  created_at: string
}

export type UsageRef = { id: string; name: string }
export type UsageResponse = { screens: UsageRef[]; groups: UsageRef[] }

export type UploadSignResponse = {
  content_id: string
  bucket: 'media'
  storage_path: string
  thumb_path: string
  signed_url: string
  token: string
  resumable: boolean
  upload_url: string
}

/** What the (admin) layout loads server-side and hands to AppProvider. */
export type AppUser = { id: string; email: string }
export type AppBootstrap = {
  user: AppUser
  profile: Profile
  org: Organization | null
  orgs: Organization[]
  /** membership role in the active org; null for a super admin who is not a member. Store managers = 'admin'/'owner'. */
  role: MembershipRole | null
}

export type CronTickResponse = {
  screens_checked: number
  went_offline: number
  came_online: number
  /** playlists touched because content in them expired since the previous tick */
  playlists_touched: number
  codes_deleted: number
}

// ---------------------------------------------------------------------------
// Device API
// ---------------------------------------------------------------------------
/**
 * POST /api/device/pairing-code. The raw device token is minted with the code and returned exactly
 * once, here (decision §0.13); the server keeps only its sha256 hash. The device holds it until the
 * code is claimed, then persists `{ device_token, screen_id }` as PlayerDeviceState.
 */
export type PairingCodeResponse = { code: string; expires_at: string; device_token: string }
/** GET /api/device/pairing-status/[code]?fingerprint= — carries no secret; repeatable until the row expires. */
export type PairingStatusResponse =
  | { claimed: false; expires_at: string }
  | { claimed: true; screen_id: string }
/** localStorage `msign.pending` while a code is on screen (survives reloads so the code does not churn). */
export type PendingPairingState = { code: string; device_token: string; expires_at: string }

/** POST /api/device/heartbeat body (`heartbeatSchema` infers to exactly this). */
export type HeartbeatRequest = {
  /** playlist_items.id currently on screen; null when idle/standby */
  current_item_id: string | null
  resolution?: string
  /** manifest.playlist_version, or -1 when no manifest has been loaded yet (always mismatches) */
  playlist_version: number
  uptime_seconds?: number
}
export type HeartbeatResponse = { playlist_version: number }

export type ManifestSchedule = {
  active_from: string | null
  active_to: string | null
  days_of_week: number[] | null
  daily_start: string | null
  daily_end: string | null
}

export type ManifestItem = {
  /** playlist_items.id — what the player reports back as current_item_id */
  id: string
  type: MediaType
  content_id: string | null
  /** 24h signed URL for media, the website url for websites */
  url: string
  thumb: string | null
  name: string
  duration_seconds: number
  transition: TransitionType
  mute: boolean
  /** websites only; 0 = never */
  refresh_seconds: number
  /** content.expires_at — the player stops showing the item once this passes; null for websites / no expiry */
  expires_at: string | null
  schedule: ManifestSchedule
}

export type Manifest = {
  screen: { id: string; name: string; rotation: Rotation; timezone: string }
  org: { name: string; logo_url: string | null }
  playlist_version: number
  generated_at: string
  items: ManifestItem[]
}

/** localStorage `msign.device` */
export type PlayerDeviceState = { device_token: string; screen_id: string }

// ---------------------------------------------------------------------------
// Realtime broadcast payloads (all channels are private; see docs/CONTRACTS.md §7)
// ---------------------------------------------------------------------------
export const SCREEN_COMMAND_EVENTS = ['sync', 'reload', 'identify', 'unpair'] as const
export type ScreenCommandEvent = (typeof SCREEN_COMMAND_EVENTS)[number]
export type ScreenCommandPayload = { at: string }

export type ScreenStatusPayload = {
  screen_id: string
  last_seen_at: string
  current_item_id: string | null
  online: true
}

export const ORG_CHANNEL_EVENTS = ['status', 'changed'] as const
export type OrgChannelEvent = (typeof ORG_CHANNEL_EVENTS)[number]

/** Root segments of lib/query-keys.ts; 'orgs' invalidates `['orgs']` (no org scope). */
export const CHANGED_TABLES = ['screens', 'content', 'websites', 'groups', 'folders', 'playlists', 'orgs'] as const
export type ChangedTable = (typeof CHANGED_TABLES)[number]
export type OrgChangedPayload = { table: ChangedTable; id?: string; at: string }

/** Value provided by RealtimeBridge / read through useRealtimeScreens(). */
export type RealtimeScreensValue = { statuses: Record<string, ScreenStatusPayload>; connected: boolean }
